import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
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
  type PurchaseLineInput
} from './hooks'
import CreatePackDialog from './CreatePackDialog'

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
  /** Loaded async on product change. Empty until then. */
  available_units: PurchasableUnit[]
  /** Index into available_units. Defaults to is_default_purchase pack else base. */
  selected_unit_idx: number
  qty: string
  unitCost: string
  lineTotal: string
  lastEdited: LastEdited | null
  warn?: string | null
}

type OverheadState = {
  category: OverheadCategory
  description: string
  amount: string
}

const emptyLine = (): LineState => ({
  product_id: '',
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
  const { t, i18n } = useTranslation(['purchases', 'common'])
  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'
  const navigate = useNavigate()
  const record = useRecordPurchase()
  const notify = useNotifier()

  const { data: allProducts } = useProducts()
  const [purchaseDate, setPurchaseDate] = useState(todayISO())
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [note, setNote] = useState('')
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
        available_units: [],
        selected_unit_idx: 0
      })
      return
    }
    setLine(i, { product_id: id })
    try {
      const units = await fetchPurchasableUnitsForProduct({
        productId: id,
        baseUnitName: 'Each'
      })
      const defaultIdx = units.findIndex((u) => u.isDefaultPurchase)
      setLine(i, {
        available_units: units,
        selected_unit_idx: defaultIdx >= 0 ? defaultIdx : 0
      })
    } catch {
      notify.error(t('purchases:errors.submit_failed'))
    }
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
      // record_purchase accepts both shapes (Phase C). Pack lines need
      // pack_id+pack_qty so the server can resolve base_qty for stock math.
      if (unit && unit.kind === 'pack' && unit.packId) {
        items.push({
          product_id: ln.product_id,
          pack_id: unit.packId,
          pack_qty: q,
          cost_at_purchase: c
        })
      } else {
        items.push({
          product_id: ln.product_id,
          qty: q,
          cost_at_purchase: c
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
        overhead_items: overheadItems
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
          </Stack>
          <Field label={t('purchases:fields.note')}>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              minRows={2}
              inputProps={{ maxLength: 1000 }}
            />
          </Field>
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
                {ln.product_id && ln.available_units.length > 0 && (
                  <Box sx={{ flex: '1 1 140px', minWidth: 130 }}>
                    <Field label={t('purchases:fields.unit')}>
                      <Select
                        size='small'
                        fullWidth
                        value={ln.selected_unit_idx}
                        onChange={(e) => {
                          const v = e.target.value as unknown as number | string
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
                    color: 'var(--warning-700)',
                    mt: 0.5,
                    display: 'block'
                  }}
                >
                  {t(`purchases:form.${ln.warn}`)}
                </Typography>
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
    </Box>
  )
}
