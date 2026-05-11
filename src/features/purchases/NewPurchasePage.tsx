import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { paths } from 'src/paths'
import { Banner, Button, Card, Field, Input, Textarea } from 'src/components/ui'
import { PageHeader } from 'src/components/layout'
import { useNotifier } from 'src/components/notistack/NotificationProvider'
import { formatPKR } from 'src/features/subscription/env'
import SupplierCombobox from 'src/features/suppliers/SupplierCombobox'
import ProductCombobox from 'src/features/products/ProductCombobox'
import { useProducts } from 'src/features/products/hooks'
import {
  fetchPurchasableUnitsForProduct,
  type PurchasableUnit
} from 'src/features/units/hooks'
import {
  useRecordPurchase,
  type OverheadCategory,
  type PurchaseLineInput,
  type PurchaseBatchInput
} from './hooks'
import CreatePackDialog from './CreatePackDialog'
import StockInVariantMatrix, { type MatrixLine } from './StockInVariantMatrix'
import { supabase } from 'src/lib/supabase'

const todayISO = () => new Date().toISOString().slice(0, 10)

const OVERHEAD_CATEGORIES: OverheadCategory[] = [
  'delivery',
  'labor',
  'customs',
  'packaging',
  'other'
]

type LastEdited = 'qty' | 'cost' | 'total'

type LineState = {
  product_id: string
  /** v2.7: when the picked product has_variants, the user picks one of its
   * variants here. Otherwise empty; the server resolves product_id → default. */
  variant_id: string
  /** v2.7 matrix UX: display label like "Red / M" for variant lines emitted
   * by the matrix dialog. Empty for single-variant lines. Cosmetic only. */
  variant_label?: string
  /** v2.7: true after the user picks a multi-variant product. Drives the
   * "Configure variants" button + suppresses the unit selector & qty/cost
   * inputs on the placeholder line until the matrix is applied. */
  is_multi_variant_placeholder?: boolean
  /** Loaded async on product change. Empty until then. */
  available_units: PurchasableUnit[]
  /** Index into available_units. Defaults to is_default_purchase pack else base. */
  selected_unit_idx: number
  qty: string
  unitCost: string
  lineTotal: string
  lastEdited: LastEdited | null
  warn?: string | null
  /** v2.8: set by handleProductChange. When true, batch fields render below
   * the line and the submit payload includes a `batch` object. */
  has_batches?: boolean
  batch_no?: string
  batch_manufactured?: string
  batch_expiry?: string
  batch_warranty_days?: string
}

type OverheadState = {
  category: OverheadCategory
  description: string
  amount: string
}

const emptyLine = (): LineState => ({
  product_id: '',
  variant_id: '',
  variant_label: '',
  is_multi_variant_placeholder: false,
  available_units: [],
  selected_unit_idx: 0,
  qty: '',
  unitCost: '',
  lineTotal: '',
  lastEdited: null
})

const emptyOverhead = (): OverheadState => ({
  category: 'delivery',
  description: '',
  amount: ''
})

const num = (s: string): number => {
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}
const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Bidirectional cost calc per line item. Last-edited field stays put;
 * the other two update if they have enough information. Per spec §5.
 */
function recompute(
  prev: LineState,
  field: 'qty' | 'cost' | 'total',
  next: string
): LineState {
  const out: LineState = { ...prev, lastEdited: field, warn: null }
  if (field === 'qty') out.qty = next
  if (field === 'cost') out.unitCost = next
  if (field === 'total') out.lineTotal = next

  const q = num(out.qty)
  const c = num(out.unitCost)
  const t = num(out.lineTotal)

  if (field === 'qty') {
    if (Number.isFinite(c)) {
      out.lineTotal = String(round2(q * c))
    } else if (Number.isFinite(t) && q > 0) {
      out.unitCost = String(round2(t / q))
    }
  } else if (field === 'cost') {
    if (Number.isFinite(q)) {
      out.lineTotal = String(round2(q * c))
    } else if (Number.isFinite(t) && c > 0) {
      const newQ = t / c
      if (Number.isInteger(newQ)) out.qty = String(newQ)
      else {
        out.qty = String(Math.round(newQ))
        out.warn = 'qty_must_divide_evenly'
      }
    }
  } else {
    // field === 'total'
    if (Number.isFinite(q) && q > 0) {
      const computed = round2(t / q)
      out.unitCost = String(computed)
      if (round2(q * computed) !== round2(t)) {
        out.warn = 'qty_must_divide_evenly'
      }
    } else if (Number.isFinite(c) && c > 0) {
      const newQ = t / c
      if (Number.isInteger(newQ)) out.qty = String(newQ)
      else {
        out.qty = String(Math.round(newQ))
        out.warn = 'qty_must_divide_evenly'
      }
    }
  }
  return out
}

export default function NewPurchasePage() {
  const { t, i18n } = useTranslation([
    'purchases',
    'common',
    'batches',
    'variants'
  ])
  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'
  const navigate = useNavigate()
  const record = useRecordPurchase()
  const notify = useNotifier()

  const { data: allProducts } = useProducts()
  const [purchaseDate, setPurchaseDate] = useState(todayISO())
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  // v2.8.1: "This is opening stock" flag for the first stock-in of a
  // product. Just toggles purchases.is_opening = true on submission.
  const [isOpening, setIsOpening] = useState(false)
  const [lines, setLines] = useState<LineState[]>([emptyLine()])
  const [overhead, setOverhead] = useState<OverheadState[]>([])
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  // Inline "Create new pack" modal state. We track which line opened it so
  // the new pack auto-selects on that line after the RPC succeeds.
  const [packDialog, setPackDialog] = useState<{
    open: boolean
    lineIndex: number
    productId: string
    productName: string
  } | null>(null)

  /** v2.7: multi-variant matrix dialog state. Opens on multi-variant product
   * pick; Apply expands into N stock-in lines (one per variant) in place. */
  const [matrixDialog, setMatrixDialog] = useState<{
    open: boolean
    lineIndex: number
    productId: string
    productName: string
  } | null>(null)

  const itemsSubtotal = useMemo(
    () =>
      lines.reduce((s, ln) => {
        const q = num(ln.qty)
        const c = num(ln.unitCost)
        if (Number.isFinite(q) && Number.isFinite(c)) return s + q * c
        return s
      }, 0),
    [lines]
  )
  const overheadSubtotal = useMemo(
    () =>
      overhead.reduce((s, o) => {
        const a = num(o.amount)
        return s + (Number.isFinite(a) ? a : 0)
      }, 0),
    [overhead]
  )
  const grandTotal = itemsSubtotal + overheadSubtotal

  const setLine = (i: number, patch: Partial<LineState>) =>
    setLines((prev) =>
      prev.map((ln, idx) => (idx === i ? { ...ln, ...patch } : ln))
    )
  const editLine = (i: number, field: 'qty' | 'cost' | 'total', val: string) =>
    setLines((prev) =>
      prev.map((ln, idx) => (idx === i ? recompute(ln, field, val) : ln))
    )

  /**
   * When the product picker fires, load that product's purchasable units and
   * pre-select the default-purchase pack (or base, if none). Per spec §6.2 we
   * do NOT auto-convert qty across unit changes — the user reasserts qty in
   * whatever unit they're invoicing in.
   */
  const handleProductChange = async (i: number, id: string | null) => {
    if (!id) {
      setLine(i, {
        product_id: '',
        variant_id: '',
        variant_label: '',
        is_multi_variant_placeholder: false,
        available_units: [],
        selected_unit_idx: 0
      })
      return
    }
    // Reset variant_id on every product change — the user picks per-product.
    setLine(i, {
      product_id: id,
      variant_id: '',
      variant_label: '',
      is_multi_variant_placeholder: false
    })

    // v2.7: detect multi-variant — open the matrix dialog instead of the
    // single-line unit selector. Multi-variant products don't have packs
    // (per v2.7 §7.5 deferred) so we skip the units fetch.
    try {
      const { data: product } = await supabase
        .from('products')
        .select('has_variants, has_batches, name')
        .eq('id', id)
        .single()
      if (product?.has_variants) {
        setLine(i, { is_multi_variant_placeholder: true })
        setMatrixDialog({
          open: true,
          lineIndex: i,
          productId: id,
          productName: product.name
        })
        return
      }

      const units = await fetchPurchasableUnitsForProduct({
        productId: id,
        baseUnitName: 'Each'
      })
      const defaultIdx = units.findIndex((u) => u.isDefaultPurchase)
      const hasBatches = !!product?.has_batches
      let suggested: string | undefined
      // v2.8: pre-fill batch_no via suggest_batch_no when product is batched.
      if (hasBatches) {
        const { data: defaultVariant } = await supabase
          .from('product_variants')
          .select('id')
          .eq('product_id', id)
          .eq('is_default', true)
          .eq('is_active', true)
          .maybeSingle()
        if (defaultVariant) {
          try {
            const { data: bno } = await supabase.rpc('suggest_batch_no', {
              p_variant_id: defaultVariant.id,
              p_received_at: purchaseDate
            })
            suggested = bno as string
          } catch {
            // non-fatal; the user can type a batch number
          }
        }
      }
      setLine(i, {
        available_units: units,
        selected_unit_idx: defaultIdx >= 0 ? defaultIdx : 0,
        has_batches: hasBatches,
        batch_no: suggested ?? '',
        batch_manufactured: '',
        batch_expiry: '',
        batch_warranty_days: '0'
      })
    } catch {
      notify.error(t('purchases:errors.submit_failed'))
    }
  }

  /**
   * v2.7 matrix Apply: replace the placeholder line at lineIndex with N new
   * lines, one per variant entry from the matrix. Each new line is a normal
   * variant-scoped stock-in line with product_id + variant_id + qty + cost.
   *
   * Existing lines for the same product are NOT touched — the user can run
   * the matrix multiple times for the same product if they want to amend.
   */
  const applyMatrix =
    (productId: string, productName: string) => (matrixLines: MatrixLine[]) => {
      if (!matrixDialog) return
      const idx = matrixDialog.lineIndex
      setLines((prev) => {
        const next = [...prev]
        const expanded: LineState[] = matrixLines.map((ml) => ({
          product_id: productId,
          variant_id: ml.variant_id,
          variant_label: ml.variant_label,
          is_multi_variant_placeholder: false,
          available_units: [],
          selected_unit_idx: 0,
          qty: String(ml.qty),
          unitCost: String(ml.cost_at_purchase),
          lineTotal: String(round2(ml.qty * ml.cost_at_purchase)),
          lastEdited: null
        }))
        next.splice(idx, 1, ...expanded)
        return next
      })
      setMatrixDialog(null)
      notify.success(
        t('variants:stock_in_matrix.reconfigure_variants', {
          count: matrixLines.length,
          productName
        })
      )
    }

  /** Cancel the matrix while a placeholder line exists: remove the line if
   * it's only a placeholder (no qty/cost filled). */
  const cancelMatrix = () => {
    if (!matrixDialog) return
    const idx = matrixDialog.lineIndex
    setLines((prev) => {
      const ln = prev[idx]
      if (ln?.is_multi_variant_placeholder) {
        // Reset the line to empty so the user can pick again
        const next = [...prev]
        next[idx] = emptyLine()
        return next
      }
      return prev
    })
    setMatrixDialog(null)
  }

  const addLine = () => setLines((prev) => [...prev, emptyLine()])
  const removeLine = (i: number) => {
    if (lines.length === 1) return
    setLines((prev) => prev.filter((_, idx) => idx !== i))
  }

  const addOverhead = () => setOverhead((prev) => [...prev, emptyOverhead()])
  const removeOverhead = (i: number) =>
    setOverhead((prev) => prev.filter((_, idx) => idx !== i))
  const setOverheadField = (i: number, patch: Partial<OverheadState>) =>
    setOverhead((prev) =>
      prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o))
    )

  const submit = async () => {
    setError(null)
    setErrors({})
    const fieldErrors: Record<string, string> = {}

    if (!purchaseDate) {
      fieldErrors.date = t('purchases:errors.date_required')
    } else if (purchaseDate > todayISO()) {
      fieldErrors.date = t('purchases:errors.date_future')
    }

    if (!supplierId) {
      fieldErrors.supplier = t('purchases:errors.supplier_required')
    }

    const items: PurchaseLineInput[] = []
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i]
      if (!ln.product_id) {
        fieldErrors[`item_${i}_product`] = t(
          'purchases:errors.product_required'
        )
        continue
      }
      // v2.7: placeholder lines for multi-variant products that haven't had
      // the matrix applied yet — block submit with a friendly message.
      if (ln.is_multi_variant_placeholder) {
        fieldErrors[`item_${i}_product`] = t(
          'variants:stock_in_matrix.configure_variants'
        )
        continue
      }
      const q = num(ln.qty)
      const c = num(ln.unitCost)
      if (!Number.isInteger(q) || q <= 0) {
        fieldErrors[`item_${i}_qty`] = t('purchases:errors.qty_invalid')
        continue
      }
      if (!Number.isFinite(c) || c < 0) {
        fieldErrors[`item_${i}_cost`] = t('purchases:errors.cost_invalid')
        continue
      }
      const unit = ln.available_units[ln.selected_unit_idx]

      // v2.8: when product is batched, require batch_no (required), expiry
      // unless "no expiry" toggled, and pack the batch object for the RPC.
      let batchPayload: PurchaseBatchInput | undefined
      if (ln.has_batches) {
        const batchNo = (ln.batch_no ?? '').trim()
        if (batchNo === '') {
          fieldErrors[`item_${i}_batch_no`] = t(
            'batches:errors.batch_no_required'
          )
          continue
        }
        // v2.8.3: expiry OR supplier_warranty_days must be set —
        // batched products without either have nothing to alert on, so
        // the has_batches flag is meaningless. Pre-check here for a
        // friendly error; record_purchase + a CHECK constraint enforce
        // it at the DB level.
        const warrantyDays = Number(ln.batch_warranty_days ?? '0')
        const expiryStr = (ln.batch_expiry ?? '').trim() || null
        const warrantyDaysVal =
          Number.isFinite(warrantyDays) && warrantyDays > 0
            ? warrantyDays
            : null
        if (expiryStr === null && warrantyDaysVal === null) {
          fieldErrors[`item_${i}_batch_expiry`] = t(
            'batches:errors.expiry_or_warranty_required'
          )
          continue
        }
        batchPayload = {
          batch_no: batchNo,
          manufactured_date: (ln.batch_manufactured ?? '').trim() || null,
          expiry_date: expiryStr,
          supplier_warranty_days: warrantyDaysVal
        }
      }

      // record_purchase accepts both shapes (Phase C). Pack lines need
      // pack_id+pack_qty so the server can resolve base_qty for stock math.
      if (unit && unit.kind === 'pack' && unit.packId) {
        items.push({
          product_id: ln.product_id,
          variant_id: ln.variant_id || undefined,
          pack_id: unit.packId,
          pack_qty: q,
          cost_at_purchase: c,
          batch: batchPayload
        })
      } else {
        items.push({
          product_id: ln.product_id,
          variant_id: ln.variant_id || undefined,
          qty: q,
          cost_at_purchase: c,
          batch: batchPayload
        })
      }
    }
    if (items.length === 0 && Object.keys(fieldErrors).length === 0) {
      fieldErrors.items = t('purchases:errors.items_required')
    }

    const overheadItems: {
      category: OverheadCategory
      amount: number
      description?: string | null
    }[] = []
    for (let i = 0; i < overhead.length; i++) {
      const o = overhead[i]
      const a = num(o.amount)
      if (!Number.isFinite(a) || a <= 0) {
        fieldErrors[`overhead_${i}_amount`] = t(
          'purchases:errors.overhead_amount_invalid'
        )
        continue
      }
      overheadItems.push({
        category: o.category,
        amount: a,
        description: o.description.trim() || null
      })
    }

    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors)
      return
    }

    try {
      const id = await record.mutateAsync({
        supplier_id: supplierId,
        purchase_date: purchaseDate,
        note: note.trim() || null,
        items,
        overhead_items: overheadItems,
        is_opening: isOpening
      })
      notify.success(t('purchases:messages.saved'))
      navigate(paths.gotoPurchase(id))
    } catch (err) {
      const msg =
        typeof (err as { message?: unknown })?.message === 'string'
          ? (err as { message: string }).message
          : ''
      if (msg.includes('supplier_not_in_shop')) {
        setError(t('purchases:errors.supplier_not_in_shop'))
      } else if (msg.includes('product_not_in_shop')) {
        setError(t('purchases:errors.product_not_in_shop'))
      } else {
        setError(t('purchases:errors.submit_failed'))
      }
    }
  }

  return (
    <Box sx={{ maxWidth: 1024, mx: 'auto', width: '100%' }}>
      <Button
        variant='ghost'
        onClick={() => navigate(paths.purchases)}
        sx={{ mb: 1 }}
      >
        {t('common:actions.back')}
      </Button>

      <PageHeader title={t('purchases:add_purchase')} />

      {error && (
        <Banner variant='error' sx={{ mb: 2 }}>
          {error}
        </Banner>
      )}

      {/* Stock-in details */}
      <Card sx={{ mb: 2 }}>
        <Typography variant='h3' sx={{ mb: 2 }}>
          {t('purchases:form.details_title')}
        </Typography>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Box sx={{ flex: '0 0 200px' }}>
              <Field
                label={t('purchases:fields.purchase_date')}
                required
                error={errors.date}
                htmlFor='purchase_date'
              >
                <Input
                  id='purchase_date'
                  type='date'
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  inputProps={{ max: todayISO() }}
                />
              </Field>
            </Box>
            <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
              <Field
                label={t('purchases:form.supplier')}
                required
                error={errors.supplier}
              >
                <SupplierCombobox
                  value={supplierId}
                  onChange={setSupplierId}
                  required
                  size='medium'
                />
              </Field>
            </Box>
          </Stack>
          <Field label={t('purchases:fields.note')}>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              minRows={2}
              inputProps={{ maxLength: 1000 }}
            />
          </Field>

          {/* v2.8.1 — "This is opening stock" checkbox. Audit-only flag;
           *  flips purchases.is_opening = true so dashboards / reports
           *  can identify the first delivery for each product. */}
          <Box>
            <FormControlLabel
              control={
                <Checkbox
                  size='small'
                  checked={isOpening}
                  onChange={(e) => setIsOpening(e.target.checked)}
                />
              }
              label={t('purchases:form.is_opening_label')}
            />
            <Typography
              variant='caption'
              sx={{ display: 'block', color: 'var(--text-muted)' }}
            >
              {t('purchases:form.is_opening_help')}
            </Typography>
          </Box>
        </Stack>
      </Card>

      {/* Items */}
      <Card sx={{ mb: 2 }}>
        <Typography variant='h3' sx={{ mb: 2 }}>
          {t('purchases:form.items_title')}
        </Typography>
        <Stack spacing={2}>
          {lines.map((ln, i) => (
            <Box
              key={i}
              sx={{
                p: 1.5,
                borderRadius: 1,
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--surface-subtle)'
              }}
            >
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.5}
                alignItems={{ xs: 'stretch', md: 'flex-end' }}
              >
                <Box
                  sx={{
                    minWidth: 32,
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                    pb: { md: 1 }
                  }}
                >
                  #{i + 1}
                </Box>
                <Box sx={{ flex: '2 1 280px', minWidth: 200 }}>
                  <Field
                    label={t('purchases:fields.product')}
                    error={errors[`item_${i}_product`]}
                  >
                    <ProductCombobox
                      value={ln.product_id || null}
                      onChange={(id) => void handleProductChange(i, id)}
                      size='small'
                    />
                  </Field>
                </Box>
                {/* v2.7: variant label badge on lines emitted by the matrix.
                    Read-only — variant is fixed for the line. */}
                {ln.variant_label && (
                  <Box sx={{ flex: '0 1 auto', alignSelf: 'center' }}>
                    <Typography
                      variant='caption'
                      sx={{
                        color: 'var(--text-brand)',
                        backgroundColor: 'var(--status-brand-bg)',
                        px: 1,
                        py: 0.25,
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: 600,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {ln.variant_label}
                    </Typography>
                  </Box>
                )}
                {/* v2.7: multi-variant placeholder — "Configure variants"
                    button opens the matrix dialog (replaces the v2.7.1
                    LineVariantPicker dropdown). */}
                {ln.is_multi_variant_placeholder && (
                  <Box sx={{ flex: '0 1 auto' }}>
                    <Button
                      variant='secondary'
                      size='sm'
                      onClick={() => {
                        const product = (allProducts ?? []).find(
                          (p) => p.id === ln.product_id
                        )
                        setMatrixDialog({
                          open: true,
                          lineIndex: i,
                          productId: ln.product_id,
                          productName: product?.name ?? ln.product_id
                        })
                      }}
                    >
                      {t('variants:stock_in_matrix.configure_variants')}
                    </Button>
                  </Box>
                )}
                {ln.product_id &&
                  !ln.is_multi_variant_placeholder &&
                  ln.available_units.length > 0 && (
                    <Box sx={{ flex: '1 1 140px', minWidth: 130 }}>
                      <Field label={t('purchases:fields.unit')}>
                        <Select
                          size='small'
                          fullWidth
                          value={ln.selected_unit_idx}
                          onChange={(e) => {
                            const v = e.target.value as unknown as
                              | number
                              | string
                            if (v === '__create_pack__') {
                              const product = (allProducts ?? []).find(
                                (p) => p.id === ln.product_id
                              )
                              setPackDialog({
                                open: true,
                                lineIndex: i,
                                productId: ln.product_id,
                                productName: product?.name ?? ln.product_id
                              })
                              return
                            }
                            setLine(i, { selected_unit_idx: Number(v) })
                          }}
                        >
                          {ln.available_units.map((u, idx) => (
                            <MenuItem key={idx} value={idx}>
                              {u.unitName}
                              {u.kind === 'pack' && ` (${u.baseQty})`}
                            </MenuItem>
                          ))}
                          <MenuItem
                            value='__create_pack__'
                            sx={{
                              color: 'var(--text-brand)',
                              fontWeight: 600,
                              borderTop: '1px solid var(--border-subtle)'
                            }}
                          >
                            {t('purchases:form.create_new_pack')}
                          </MenuItem>
                        </Select>
                      </Field>
                    </Box>
                  )}
                {!ln.is_multi_variant_placeholder && (
                  <>
                    <Box sx={{ flex: '1 1 100px', minWidth: 90 }}>
                      <Field
                        label={t('purchases:fields.qty')}
                        error={errors[`item_${i}_qty`]}
                      >
                        <Input
                          value={ln.qty}
                          onChange={(e) => editLine(i, 'qty', e.target.value)}
                          type='number'
                          inputProps={{ min: 1, step: 1 }}
                        />
                      </Field>
                    </Box>
                    <Box sx={{ flex: '1 1 130px', minWidth: 100 }}>
                      <Field
                        label={
                          ln.available_units.length > 1
                            ? t('purchases:fields.cost_per_unit', {
                                unitName:
                                  ln.available_units[ln.selected_unit_idx]
                                    ?.unitName ?? ''
                              })
                            : t('purchases:fields.cost')
                        }
                        error={errors[`item_${i}_cost`]}
                      >
                        <Input
                          value={ln.unitCost}
                          onChange={(e) => editLine(i, 'cost', e.target.value)}
                          type='number'
                          inputProps={{ min: 0, step: '0.01' }}
                        />
                      </Field>
                      {(() => {
                        const unit = ln.available_units[ln.selected_unit_idx]
                        const cost = num(ln.unitCost)
                        if (
                          unit?.kind === 'pack' &&
                          unit.baseQty > 1 &&
                          cost > 0
                        ) {
                          return (
                            <Typography
                              variant='caption'
                              sx={{
                                color: 'var(--text-muted)',
                                display: 'block',
                                mt: 0.25
                              }}
                            >
                              {t('purchases:fields.per_piece_cost', {
                                cost: formatPKR(cost / unit.baseQty, locale)
                              })}
                            </Typography>
                          )
                        }
                        return null
                      })()}
                    </Box>
                    <Box sx={{ flex: '1 1 130px', minWidth: 100 }}>
                      <Field label={t('purchases:fields.total')}>
                        <Input
                          value={ln.lineTotal}
                          onChange={(e) => editLine(i, 'total', e.target.value)}
                          type='number'
                          inputProps={{ min: 0, step: '0.01' }}
                        />
                      </Field>
                    </Box>
                  </>
                )}
                <Box>
                  <IconButton
                    aria-label={t('purchases:actions.remove_line')}
                    onClick={() => removeLine(i)}
                    disabled={lines.length === 1}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              </Stack>
              {ln.warn && (
                <Typography
                  variant='caption'
                  sx={{
                    color: 'var(--status-warning-text)',
                    mt: 0.5,
                    display: 'block'
                  }}
                >
                  {t(`purchases:form.${ln.warn}`)}
                </Typography>
              )}
              {/* v2.8: batch info block. Appears only when the picked
               *  product has has_batches=true. Mirrors record_purchase's
               *  expected payload shape. */}
              {ln.has_batches && !ln.is_multi_variant_placeholder && (
                <Box
                  sx={{
                    mt: 1,
                    p: 1.5,
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--surface-muted)'
                  }}
                >
                  <Typography
                    variant='overline'
                    sx={{ color: 'var(--text-muted)', display: 'block', mb: 1 }}
                  >
                    {t('batches:stock_in_section_title')}
                  </Typography>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1.5}
                    alignItems={{ xs: 'stretch', sm: 'flex-end' }}
                  >
                    <Box sx={{ flex: '1 1 200px' }}>
                      <Field
                        label={t('batches:fields.batch_no')}
                        error={errors[`item_${i}_batch_no`]}
                      >
                        <TextField
                          size='small'
                          fullWidth
                          value={ln.batch_no ?? ''}
                          onChange={(e) =>
                            setLine(i, { batch_no: e.target.value })
                          }
                        />
                      </Field>
                    </Box>
                    <Box sx={{ flex: '1 1 150px' }}>
                      <Field label={t('batches:fields.manufactured_date')}>
                        <TextField
                          type='date'
                          size='small'
                          fullWidth
                          slotProps={{ inputLabel: { shrink: true } }}
                          value={ln.batch_manufactured ?? ''}
                          onChange={(e) =>
                            setLine(i, { batch_manufactured: e.target.value })
                          }
                        />
                      </Field>
                    </Box>
                    <Box sx={{ flex: '1 1 150px' }}>
                      <Field
                        label={t('batches:fields.expiry_date')}
                        error={errors[`item_${i}_batch_expiry`]}
                      >
                        <TextField
                          type='date'
                          size='small'
                          fullWidth
                          slotProps={{ inputLabel: { shrink: true } }}
                          value={ln.batch_expiry ?? ''}
                          onChange={(e) =>
                            setLine(i, { batch_expiry: e.target.value })
                          }
                        />
                      </Field>
                    </Box>
                    <Box sx={{ flex: '1 1 140px' }}>
                      <Field label={t('batches:fields.supplier_warranty_days')}>
                        <TextField
                          type='number'
                          size='small'
                          fullWidth
                          inputProps={{ min: 0, step: 1 }}
                          value={ln.batch_warranty_days ?? '0'}
                          onChange={(e) =>
                            setLine(i, { batch_warranty_days: e.target.value })
                          }
                        />
                      </Field>
                    </Box>
                  </Stack>
                </Box>
              )}
            </Box>
          ))}

          {errors.items && <Banner variant='error'>{errors.items}</Banner>}

          <Box>
            <Button
              variant='ghost'
              startIcon={<AddIcon />}
              onClick={addLine}
              size='sm'
            >
              {t('purchases:form.add_product')}
            </Button>
          </Box>

          <Stack
            direction='row'
            justifyContent='space-between'
            sx={{
              pt: 1.5,
              borderTop: '1px solid var(--border-subtle)'
            }}
          >
            <Typography variant='body1' sx={{ fontWeight: 600 }}>
              {t('purchases:form.items_subtotal')}
            </Typography>
            <Typography variant='body1' sx={{ fontWeight: 600 }}>
              {formatPKR(itemsSubtotal, locale)}
            </Typography>
          </Stack>
        </Stack>
      </Card>

      {/* Additional costs */}
      <Card sx={{ mb: 2 }}>
        <Stack
          direction='row'
          justifyContent='space-between'
          alignItems='center'
          sx={{ mb: 1 }}
        >
          <Typography variant='h3'>
            {t('purchases:form.overhead_title')}
          </Typography>
        </Stack>
        <Typography
          variant='caption'
          sx={{ color: 'var(--text-muted)', display: 'block', mb: 2 }}
        >
          {t('purchases:form.overhead_help')}
        </Typography>
        <Stack spacing={1.5}>
          {overhead.map((o, i) => (
            <Stack
              key={i}
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              alignItems={{ xs: 'stretch', sm: 'flex-end' }}
            >
              <Box
                sx={{
                  minWidth: 32,
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  pb: 1
                }}
              >
                #{i + 1}
              </Box>
              <Box sx={{ flex: '1 1 160px' }}>
                <Field label={t('purchases:fields.category')}>
                  <TextField
                    select
                    size='small'
                    fullWidth
                    value={o.category}
                    onChange={(e) =>
                      setOverheadField(i, {
                        category: e.target.value as OverheadCategory
                      })
                    }
                  >
                    {OVERHEAD_CATEGORIES.map((cat) => (
                      <MenuItem key={cat} value={cat}>
                        {t(`purchases:form.category.${cat}`)}
                      </MenuItem>
                    ))}
                  </TextField>
                </Field>
              </Box>
              <Box sx={{ flex: '2 1 220px' }}>
                <Field label={t('purchases:fields.description')}>
                  <Input
                    value={o.description}
                    onChange={(e) =>
                      setOverheadField(i, { description: e.target.value })
                    }
                    inputProps={{ maxLength: 500 }}
                  />
                </Field>
              </Box>
              <Box sx={{ flex: '1 1 130px' }}>
                <Field
                  label={t('purchases:fields.amount')}
                  error={errors[`overhead_${i}_amount`]}
                >
                  <Input
                    value={o.amount}
                    onChange={(e) =>
                      setOverheadField(i, { amount: e.target.value })
                    }
                    type='number'
                    inputProps={{ min: 0, step: '0.01' }}
                  />
                </Field>
              </Box>
              <Box>
                <IconButton
                  aria-label={t('purchases:actions.remove_line')}
                  onClick={() => removeOverhead(i)}
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            </Stack>
          ))}
          <Box>
            <Button
              variant='ghost'
              startIcon={<AddIcon />}
              onClick={addOverhead}
              size='sm'
            >
              {t('purchases:form.add_cost')}
            </Button>
          </Box>
          <Stack
            direction='row'
            justifyContent='space-between'
            sx={{
              pt: 1.5,
              borderTop: '1px solid var(--border-subtle)'
            }}
          >
            <Typography variant='body1' sx={{ fontWeight: 600 }}>
              {t('purchases:form.overhead_subtotal')}
            </Typography>
            <Typography variant='body1' sx={{ fontWeight: 600 }}>
              {formatPKR(overheadSubtotal, locale)}
            </Typography>
          </Stack>
        </Stack>
      </Card>

      {/* Grand total */}
      <Card sx={{ mb: 2 }}>
        <Typography variant='h3' sx={{ mb: 2 }}>
          {t('purchases:form.totals_title')}
        </Typography>
        <Stack spacing={1}>
          <Stack direction='row' justifyContent='space-between'>
            <Typography variant='body2'>
              {t('purchases:form.items_subtotal')}
            </Typography>
            <Typography variant='body2'>
              {formatPKR(itemsSubtotal, locale)}
            </Typography>
          </Stack>
          <Stack direction='row' justifyContent='space-between'>
            <Typography variant='body2'>
              {t('purchases:form.overhead_subtotal')}
            </Typography>
            <Typography variant='body2'>
              {formatPKR(overheadSubtotal, locale)}
            </Typography>
          </Stack>
          <Stack
            direction='row'
            justifyContent='space-between'
            sx={{
              pt: 1,
              borderTop: '1px solid var(--border-subtle)'
            }}
          >
            <Typography variant='body1' sx={{ fontWeight: 700 }}>
              {t('purchases:form.grand_total')}
            </Typography>
            <Typography variant='body1' sx={{ fontWeight: 700 }}>
              {formatPKR(grandTotal, locale)}
            </Typography>
          </Stack>
        </Stack>
      </Card>

      <Stack direction='row' spacing={1.5} justifyContent='flex-end'>
        <Button
          variant='ghost'
          onClick={() => navigate(paths.purchases)}
          disabled={record.isPending}
        >
          {t('common:actions.cancel')}
        </Button>
        <Button variant='primary' onClick={submit} loading={record.isPending}>
          {t('purchases:form.submit')}
        </Button>
      </Stack>

      {packDialog && (
        <CreatePackDialog
          open={packDialog.open}
          onClose={() => setPackDialog(null)}
          productId={packDialog.productId}
          productName={packDialog.productName}
          onCreated={async (newPackId) => {
            // Refetch the line's units so the new pack appears, then select it.
            const i = packDialog.lineIndex
            try {
              const units = await fetchPurchasableUnitsForProduct({
                productId: packDialog.productId,
                baseUnitName: 'Each'
              })
              const idx = units.findIndex((u) => u.packId === newPackId)
              setLine(i, {
                available_units: units,
                selected_unit_idx: idx >= 0 ? idx : 0
              })
            } catch {
              // non-fatal — the existing line state is still valid; user
              // can re-pick after refresh.
            }
          }}
        />
      )}

      {matrixDialog && (
        <StockInVariantMatrix
          open={matrixDialog.open}
          productId={matrixDialog.productId}
          productName={matrixDialog.productName}
          onClose={cancelMatrix}
          onApply={applyMatrix(
            matrixDialog.productId,
            matrixDialog.productName
          )}
        />
      )}
    </Box>
  )
}
