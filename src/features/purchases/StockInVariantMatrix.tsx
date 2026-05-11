import { useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Checkbox from '@mui/material/Checkbox'
import Divider from '@mui/material/Divider'
import { useTranslation } from 'react-i18next'
import {
  Banner,
  Button,
  Dialog,
  DataTable,
  Field,
  Input,
  type DataTableColumn
} from 'src/components/ui'
import { useProductVariants } from 'src/features/products/hooks'
import { formatPKR } from 'src/features/subscription/env'

export type MatrixLine = {
  variant_id: string
  variant_label: string
  qty: number
  cost_at_purchase: number
}

type Row = {
  variant_id: string
  variant_label: string
  current_stock: number
  qty: string
  cost: string
  included: boolean
}

type Props = {
  open: boolean
  productId: string
  productName: string
  /** Pre-fill values: if user has already configured this product on the
   * stock-in form, opening the dialog again starts from where they left off. */
  initialLines?: MatrixLine[]
  onClose: () => void
  onApply: (lines: MatrixLine[]) => void
}

/**
 * v2.7 §7 stock-in matrix dialog (supersedes the §7.6 expanding-line fallback
 * for multi-variant products).
 *
 * Renders one row per active variant with qty + cost inputs, a "Per-unit cost
 * apply to all" common input that fills cost cells in one click, and a totals
 * footer. Apply emits MatrixLine[] (one entry per row with qty > 0); the
 * caller turns those into stock-in line items. The dialog is dumb about packs:
 * for v1 it's base-units only. Variants with packs (the "tape rolls" case)
 * still work — the qty is in base units and the cost is per base unit.
 */
export default function StockInVariantMatrix({
  open,
  productId,
  productName,
  initialLines = [],
  onClose,
  onApply
}: Props) {
  const { t, i18n } = useTranslation(['variants', 'purchases', 'common'])
  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'
  const { data: variants = [], isLoading } = useProductVariants(productId)

  const [rows, setRows] = useState<Row[]>([])
  const [perUnitCost, setPerUnitCost] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Build the working state from the variants list, layering on any
  // pre-filled MatrixLine entries from a prior Apply.
  useEffect(() => {
    if (!open) return
    const preById = new Map<string, MatrixLine>(
      initialLines.map((l) => [l.variant_id, l])
    )
    const activeVariants = variants.filter(
      (v) => v.variant_is_active && !v.is_default
    )
    setRows(
      activeVariants.map((v) => {
        const pre = preById.get(v.variant_id)
        return {
          variant_id: v.variant_id,
          variant_label: v.variant_label ?? v.sku ?? v.variant_id.slice(0, 6),
          current_stock: v.stock,
          qty: pre ? String(pre.qty) : '',
          cost: pre ? String(pre.cost_at_purchase) : '',
          included: !!pre
        }
      })
    )
    setError(null)
  }, [open, variants.length])

  const totals = useMemo(() => {
    let units = 0
    let subtotal = 0
    for (const r of rows) {
      const q = Number(r.qty)
      const c = Number(r.cost)
      if (r.included && Number.isFinite(q) && q > 0) {
        units += q
        if (Number.isFinite(c) && c >= 0) {
          subtotal += q * c
        }
      }
    }
    return { units, subtotal }
  }, [rows])

  const updateRow = (variant_id: string, patch: Partial<Row>) => {
    setRows((prev) =>
      prev.map((r) => (r.variant_id === variant_id ? { ...r, ...patch } : r))
    )
  }

  const applyPerUnitCostToAll = () => {
    const c = Number(perUnitCost)
    if (!Number.isFinite(c) || c < 0) return
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        cost: String(c),
        // If the user types a cost in the "apply to all" then clicks the
        // button, auto-include any row that has a qty filled in.
        included: r.included || Number(r.qty) > 0
      }))
    )
  }

  const handleApply = () => {
    setError(null)
    const lines: MatrixLine[] = []
    for (const r of rows) {
      if (!r.included) continue
      const q = Number(r.qty)
      const c = Number(r.cost)
      if (!Number.isInteger(q) || q <= 0) {
        setError(t('purchases:errors.qty_invalid') + ` — ${r.variant_label}`)
        return
      }
      if (!Number.isFinite(c) || c < 0) {
        setError(t('purchases:errors.cost_invalid') + ` — ${r.variant_label}`)
        return
      }
      lines.push({
        variant_id: r.variant_id,
        variant_label: r.variant_label,
        qty: q,
        cost_at_purchase: c
      })
    }
    if (lines.length === 0) {
      setError(t('variants:errors.need_at_least_one_combination'))
      return
    }
    onApply(lines)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth='md'
      fullWidth
      title={t('variants:stock_in_matrix.title', { productName })}
      actions={
        <>
          <Button variant='ghost' onClick={onClose}>
            {t('common:actions.cancel')}
          </Button>
          <Button variant='primary' onClick={handleApply}>
            {t('variants:stock_in_matrix.apply')}
          </Button>
        </>
      }
    >
      <Stack spacing={2} sx={{ pt: 1 }}>
        {error && <Banner variant='error'>{error}</Banner>}

        {isLoading ? (
          <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
            {t('common:loading')}
          </Typography>
        ) : rows.length === 0 ? (
          <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
            {t('variants:variants_count', { count: 0 })}
          </Typography>
        ) : (
          <>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              alignItems={{ sm: 'flex-end' }}
            >
              <Field
                label={t('variants:stock_in_matrix.per_unit_cost')}
                hint={t('variants:stock_in_matrix.per_unit_cost_help')}
              >
                <Input
                  type='number'
                  inputProps={{ step: '0.01', min: 0, inputMode: 'numeric' }}
                  value={perUnitCost}
                  onChange={(e) => setPerUnitCost(e.target.value)}
                />
              </Field>
              <Button
                variant='secondary'
                onClick={applyPerUnitCostToAll}
                disabled={
                  perUnitCost === '' ||
                  !Number.isFinite(Number(perUnitCost)) ||
                  Number(perUnitCost) < 0
                }
              >
                {t('variants:stock_in_matrix.apply_to_all')}
              </Button>
            </Stack>

            <MatrixTable rows={rows} onUpdateRow={updateRow} />

            <Divider sx={{ borderColor: 'var(--border-subtle)' }} />
            <Stack
              direction='row'
              spacing={3}
              sx={{ color: 'var(--text-muted)' }}
            >
              <Typography variant='body2'>
                {t('variants:stock_in_matrix.total_units')}: {totals.units}
              </Typography>
              <Typography variant='body2'>
                {t('variants:stock_in_matrix.subtotal')}:{' '}
                {formatPKR(totals.subtotal, locale)}
              </Typography>
            </Stack>
          </>
        )}
      </Stack>
    </Dialog>
  )
}

function MatrixTable({
  rows,
  onUpdateRow
}: {
  rows: Row[]
  onUpdateRow: (variant_id: string, patch: Partial<Row>) => void
}) {
  const { t } = useTranslation(['variants'])

  const columns: DataTableColumn<Row>[] = [
    {
      id: 'include',
      header: '',
      align: 'center',
      width: 56,
      cell: (row) => (
        <Checkbox
          checked={row.included}
          onChange={(e) =>
            onUpdateRow(row.variant_id, { included: e.target.checked })
          }
        />
      )
    },
    {
      id: 'variant',
      header: t('variants:columns.variant'),
      cell: (row) => (
        <Box>
          <Typography variant='body1' sx={{ fontWeight: 500 }}>
            {row.variant_label}
          </Typography>
          <Typography variant='caption' sx={{ color: 'var(--text-muted)' }}>
            {t('variants:stock_in_matrix.current_stock', {
              count: row.current_stock
            })}
          </Typography>
        </Box>
      )
    },
    {
      id: 'qty',
      header: t('variants:stock_in_matrix.qty'),
      align: 'end',
      cell: (row) => (
        <Input
          type='number'
          inputProps={{ step: 1, min: 0, inputMode: 'numeric' }}
          value={row.qty}
          onChange={(e) =>
            onUpdateRow(row.variant_id, {
              qty: e.target.value,
              // Auto-include any row whose qty becomes > 0 so the user
              // doesn't need to click the checkbox separately.
              included: Number(e.target.value) > 0 || row.included
            })
          }
        />
      )
    },
    {
      id: 'cost',
      header: t('variants:stock_in_matrix.cost_per_unit'),
      align: 'end',
      cell: (row) => (
        <Input
          type='number'
          inputProps={{ step: '0.01', min: 0, inputMode: 'numeric' }}
          value={row.cost}
          onChange={(e) =>
            onUpdateRow(row.variant_id, { cost: e.target.value })
          }
        />
      )
    },
    {
      id: 'subtotal',
      header: t('variants:stock_in_matrix.subtotal'),
      align: 'end',
      cell: (row) => {
        const q = Number(row.qty)
        const c = Number(row.cost)
        if (
          !row.included ||
          !Number.isFinite(q) ||
          !Number.isFinite(c) ||
          q <= 0
        ) {
          return '—'
        }
        return (q * c).toFixed(2)
      }
    }
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowId={(r) => r.variant_id}
      ariaLabel='variant matrix'
    />
  )
}
