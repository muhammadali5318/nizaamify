import { useEffect, useMemo, useReducer, useState } from 'react'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import ProductTable from 'src/features/products/ProductTable'
import type { ProductSearchRow } from 'src/features/products/hooks'
import { useRecordSale } from './hooks'
import Receipt, { type ReceiptLine } from './Receipt'
import QtyStepper from './QtyStepper'
import { formatPKR } from 'src/features/subscription/env'
import { useNotifier } from 'src/components/notistack/NotificationProvider'
import { supabase } from 'src/lib/supabase'
import CustomerPicker from 'src/features/customers/CustomerPicker'
import { useCustomer } from 'src/features/customers/hooks'
import { useTiers } from 'src/features/tiers/hooks'
import OverrideDiscountDialog, {
  type OverrideValue
} from './OverrideDiscountDialog'
import {
  Badge,
  Banner,
  Button,
  Card,
  Drawer,
  Field,
  Input,
  Textarea,
  Tooltip
} from 'src/components/ui'
import { PageHeader } from 'src/components/layout'

export type DiscountType = 'percent' | 'fixed'

type CartItem = {
  product_id: string
  name: string
  type: string
  default_price: number
  price: number
  qty: number
  avg_cost: number
  stock: number
  /** v2.2 per-line discount. Both null = no discount. */
  line_discount_type: DiscountType | null
  line_discount_value: number | null
}

type AddItem = Omit<
  CartItem,
  'qty' | 'line_discount_type' | 'line_discount_value'
>

type CartAction =
  | { type: 'add'; item: AddItem; qtyDelta?: number }
  | { type: 'set_qty'; product_id: string; qty: number }
  | { type: 'remove'; product_id: string }
  | { type: 'set_price'; product_id: string; price: number }
  | {
      type: 'set_line_discount'
      product_id: string
      discount_type: DiscountType
      discount_value: number
    }
  | { type: 'clear_line_discount'; product_id: string }
  | { type: 'reset' }

function cartReducer(state: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case 'add': {
      const delta = Math.max(1, Math.trunc(action.qtyDelta ?? 1))
      const existing = state.find(
        (c) => c.product_id === action.item.product_id
      )
      if (existing) {
        const nextQty = Math.min(existing.qty + delta, existing.stock)
        if (nextQty === existing.qty) return state
        return state.map((c) =>
          c.product_id === action.item.product_id ? { ...c, qty: nextQty } : c
        )
      }
      return [
        ...state,
        {
          ...action.item,
          qty: Math.min(delta, action.item.stock),
          line_discount_type: null,
          line_discount_value: null
        }
      ]
    }
    case 'set_qty': {
      return state.map((c) =>
        c.product_id === action.product_id
          ? {
              ...c,
              qty: Math.max(1, Math.min(c.stock, Math.trunc(action.qty)))
            }
          : c
      )
    }
    case 'remove':
      return state.filter((c) => c.product_id !== action.product_id)
    case 'set_price':
      return state.map((c) =>
        c.product_id === action.product_id ? { ...c, price: action.price } : c
      )
    case 'set_line_discount':
      return state.map((c) =>
        c.product_id === action.product_id
          ? {
              ...c,
              line_discount_type: action.discount_type,
              line_discount_value: action.discount_value
            }
          : c
      )
    case 'clear_line_discount':
      return state.map((c) =>
        c.product_id === action.product_id
          ? {
              ...c,
              line_discount_type: null,
              line_discount_value: null
            }
          : c
      )
    case 'reset':
      return []
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Per-line subtotal before discount = qty × price. */
function lineSubtotal(c: CartItem): number {
  return round2(c.qty * c.price)
}

/** Applied discount in PKR (capped at line subtotal). */
function lineDiscountAmount(c: CartItem): number {
  if (c.line_discount_type === null || c.line_discount_value === null) return 0
  const sub = lineSubtotal(c)
  if (c.line_discount_type === 'percent') {
    return round2((sub * c.line_discount_value) / 100)
  }
  return Math.min(round2(c.line_discount_value), sub)
}

function lineTotal(c: CartItem): number {
  return round2(lineSubtotal(c) - lineDiscountAmount(c))
}

function useShopName() {
  return useQuery({
    queryKey: ['shop-name'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shops')
        .select('shop_name')
        .single()
      if (error) throw error
      return data.shop_name
    }
  })
}

export default function POSPage() {
  const { t, i18n } = useTranslation(['pos', 'common'])
  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'
  const notify = useNotifier()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  const { data: shopName } = useShopName()
  const recordSale = useRecordSale()

  const [cart, dispatch] = useReducer(cartReducer, [])
  const [serviceCharge, setServiceCharge] = useState('0')
  const [amountPaidStr, setAmountPaidStr] = useState('0')
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [cartOpen, setCartOpen] = useState(false)
  const [receipt, setReceipt] = useState<{
    open: boolean
    invoiceId: string
    lines: ReceiptLine[]
    paymentType: 'cash' | 'credit' | 'partial'
    service: number
    total: number
    amountPaid: number
    onCredit: number
    customer: string | undefined
    notes: string
  }>({
    open: false,
    invoiceId: '',
    lines: [],
    paymentType: 'cash',
    service: 0,
    total: 0,
    amountPaid: 0,
    onCredit: 0,
    customer: undefined,
    notes: ''
  })
  const [error, setError] = useState<string | null>(null)

  // ---- v2.2 discount math ----
  // items_subtotal: sum of line totals (after per-line discounts).
  const itemsSubtotal = round2(cart.reduce((s, c) => s + lineTotal(c), 0))
  const service = Math.max(0, Number(serviceCharge) || 0)

  // Override (set via the modal) takes precedence over the customer's tier.
  const [override, setOverride] = useState<OverrideValue | null>(null)
  const [overrideOpen, setOverrideOpen] = useState(false)

  const { data: tiers = [] } = useTiers()
  const { data: selectedCustomer } = useCustomer(customerId ?? undefined)
  // Resolve the active tier % the same way record_sale does:
  //   override → customer's tier → shop default → 0
  const customerTier = selectedCustomer?.tier_id
    ? tiers.find((t2) => t2.id === selectedCustomer.tier_id)
    : undefined
  const defaultTier = tiers.find((t2) => t2.is_default)
  const activeTier = customerTier ?? defaultTier
  const activeTierPercent = activeTier?.discount_percent ?? 0

  const tierDiscountAmount = override
    ? override.type === 'percent'
      ? round2((itemsSubtotal * override.value) / 100)
      : Math.min(round2(override.value), itemsSubtotal)
    : round2((itemsSubtotal * activeTierPercent) / 100)

  const total = round2(itemsSubtotal - tierDiscountAmount + service)
  const amountPaid = Math.min(Math.max(0, Number(amountPaidStr) || 0), total)
  const onCredit = Math.max(0, total - amountPaid)
  const itemCount = cart.reduce((s, c) => s + c.qty, 0)

  // Default amount_paid to total when total changes (sane "cash" default).
  useEffect(() => {
    setAmountPaidStr(total.toFixed(2))
  }, [total])

  const paymentType: 'cash' | 'credit' | 'partial' =
    onCredit === 0 ? 'cash' : amountPaid === 0 ? 'credit' : 'partial'

  const customerRequired = onCredit > 0

  const submitLabel = useMemo(() => {
    if (paymentType === 'cash') return t('pos:submit.cash')
    if (paymentType === 'credit') return t('pos:submit.credit')
    return t('pos:submit.partial', {
      paid: formatPKR(amountPaid, locale),
      credit: formatPKR(onCredit, locale)
    })
  }, [paymentType, amountPaid, onCredit, locale, t])

  const isSubmittable =
    !recordSale.isPending &&
    (cart.length > 0 || service > 0) &&
    amountPaid >= 0 &&
    amountPaid <= total &&
    (!customerRequired || !!customerId)

  // Surfaces *why* submit is disabled, inline above the button (spec §7.2).
  const submitDisabledReason = useMemo(() => {
    if (recordSale.isPending) return null
    if (cart.length === 0 && service === 0) return t('pos:errors.empty_sale')
    if (amountPaid > total) return t('pos:errors.amount_exceeds_total')
    if (customerRequired && !customerId)
      return t('pos:customer.required_for_credit')
    return null
  }, [
    recordSale.isPending,
    cart.length,
    service,
    amountPaid,
    total,
    customerRequired,
    customerId,
    t
  ])

  /**
   * Adds `qtyDelta` base units to the cart for the given product. The default
   * (qtyDelta=1) handles the regular `+` button; quick-add pack buttons pass
   * the pack's `base_qty` so a single click lands the whole pack's worth in
   * the cart at the per-unit price (spec §5.5).
   */
  const handleAddProduct = (row: ProductSearchRow, qtyDelta = 1) => {
    if (row.stock <= 0) return
    const existing = cart.find((c) => c.product_id === row.id)
    const currentQty = existing?.qty ?? 0
    if (currentQty + qtyDelta > row.stock) {
      notify.warning(t('pos:picker.stock_capped', { count: row.stock }))
      // Still add up to the cap so the user sees something happen.
    }
    dispatch({
      type: 'add',
      qtyDelta,
      item: {
        product_id: row.id,
        name: row.name,
        type: row.type,
        default_price: Number(row.price),
        price: Number(row.price),
        avg_cost: Number(row.avg_cost),
        stock: row.stock
      }
    })
  }

  const submit = async () => {
    setError(null)
    if (cart.length === 0 && service === 0) {
      setError(t('pos:errors.empty_sale'))
      return
    }
    if (amountPaid > total) {
      setError(t('pos:errors.amount_exceeds_total'))
      return
    }
    if (customerRequired && !customerId) {
      setError(t('pos:errors.customer_required'))
      return
    }

    try {
      const items = cart.map((c) => ({
        product_id: c.product_id,
        qty: c.qty,
        price_at_sale: c.price,
        // v2.2: omit line_discount fields when no discount on this line so the
        // server stores NULL/0 (matches the consistency check).
        line_discount_type: c.line_discount_type,
        line_discount_value: c.line_discount_value
      }))
      const invoiceId = await recordSale.mutateAsync({
        customer_id: customerId,
        amount_paid: amountPaid,
        service_charge: service,
        notes: notes.trim() || null,
        items,
        tier_override_type: override?.type ?? null,
        tier_override_value: override?.value ?? null
      })
      setReceipt({
        open: true,
        invoiceId: invoiceId as unknown as string,
        lines: cart.map((c) => ({
          product_id: c.product_id,
          name: c.name,
          qty: c.qty,
          price: c.price
        })),
        paymentType,
        service,
        total,
        amountPaid,
        onCredit,
        customer: selectedCustomer?.name,
        notes: notes.trim()
      })
      dispatch({ type: 'reset' })
      setServiceCharge('0')
      setCustomerId(null)
      setNotes('')
      setCartOpen(false)
      notify.success(t('pos:messages.saved'))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
      if (msg.includes('insufficient_stock')) {
        setError(t('pos:errors.stock_insufficient'))
      } else if (msg.includes('amount_paid_exceeds_total')) {
        setError(t('pos:errors.amount_exceeds_total'))
      } else if (msg.includes('customer_required_for_credit')) {
        setError(t('pos:errors.customer_required'))
      } else if (msg.includes('empty_sale')) {
        setError(t('pos:errors.empty_sale'))
      } else if (msg.includes('line_discount_percent_out_of_range')) {
        setError(t('pos:errors.line_discount_percent_out_of_range'))
      } else if (msg.includes('line_discount_exceeds_line_subtotal')) {
        setError(t('pos:errors.line_discount_exceeds_line'))
      } else if (msg.includes('override_percent_out_of_range')) {
        setError(t('pos:errors.override_percent_out_of_range'))
      } else if (msg.includes('override_fixed_exceeds_items_subtotal')) {
        setError(t('pos:errors.override_fixed_exceeds_items'))
      } else {
        setError(t('pos:errors.submit_failed'))
      }
    }
  }

  const cartPanel = (
    <CartPanel
      cart={cart}
      dispatch={dispatch}
      itemsSubtotal={itemsSubtotal}
      tierDiscountAmount={tierDiscountAmount}
      activeTierName={activeTier?.name ?? null}
      activeTierPercent={activeTierPercent}
      override={override}
      onOpenOverride={() => setOverrideOpen(true)}
      total={total}
      onCredit={onCredit}
      service={service}
      serviceCharge={serviceCharge}
      setServiceCharge={setServiceCharge}
      amountPaidStr={amountPaidStr}
      setAmountPaidStr={setAmountPaidStr}
      customerId={customerId}
      setCustomerId={setCustomerId}
      customerRequired={customerRequired}
      notes={notes}
      setNotes={setNotes}
      submitLabel={submitLabel}
      submit={submit}
      submitting={recordSale.isPending}
      isSubmittable={isSubmittable}
      submitDisabledReason={submitDisabledReason}
      error={error}
      locale={locale}
      isMobile={isMobile}
      onAtMaxAttempt={(stock) =>
        notify.warning(t('pos:picker.stock_capped', { count: stock }))
      }
    />
  )

  return (
    <Box>
      <PageHeader title={t('pos:title')} />

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        alignItems='flex-start'
      >
        <Box sx={{ flex: 1, width: '100%', minWidth: 0 }}>
          <ProductTable
            onlyInStock
            showAvgCost
            loadBreakdownsForActions
            renderActions={(row, breakdown) => {
              const isScanOnly = !!breakdown?.is_scan_only
              const packs = breakdown?.pack_breakdown ?? []
              return (
                <Stack
                  direction='row'
                  spacing={0.5}
                  alignItems='center'
                  flexWrap='wrap'
                  rowGap={0.5}
                >
                  {!isScanOnly && (
                    <Tooltip title={t('pos:picker.add_to_cart')}>
                      <span>
                        <IconButton
                          onClick={() => handleAddProduct(row)}
                          disabled={row.stock <= 0}
                          sx={{
                            width: 40,
                            height: 40,
                            backgroundColor: 'var(--action-accent)',
                            color: 'var(--action-accent-text)',
                            transition:
                              'transform var(--duration-fast) var(--ease-out), background-color var(--duration-fast) var(--ease-out)',
                            '&:hover': {
                              backgroundColor: 'var(--action-accent-hover)'
                            },
                            '&:active': { transform: 'scale(0.98)' },
                            '&.Mui-disabled': {
                              backgroundColor: 'var(--neutral-200)',
                              color: 'var(--text-disabled)'
                            }
                          }}
                          aria-label={t('pos:picker.add_to_cart')}
                        >
                          <AddIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                  {packs.map((p) => (
                    <Tooltip
                      key={p.pack_id}
                      title={t('pos:cart.quick_add_pack', {
                        unitName: p.unit_name,
                        baseQty: p.base_qty
                      })}
                    >
                      <span>
                        <Button
                          variant='secondary'
                          size='sm'
                          disabled={row.stock < p.base_qty}
                          onClick={() => handleAddProduct(row, p.base_qty)}
                        >
                          {`+${p.base_qty} ${p.unit_name}`}
                        </Button>
                      </span>
                    </Tooltip>
                  ))}
                </Stack>
              )
            }}
          />
        </Box>

        {!isMobile && (
          <Box sx={{ width: 420, flexShrink: 0 }}>
            <Card variant='elevated' noPadding>
              <Box sx={{ p: 2 }}>{cartPanel}</Box>
            </Card>
          </Box>
        )}
      </Stack>

      {/* Mobile bottom-sheet cart per spec §7.2 mobile POS */}
      {isMobile && (
        <>
          <Box
            sx={{
              position: 'fixed',
              insetInline: 0,
              bottom: 0,
              height: 64,
              backgroundColor: 'var(--surface-base)',
              borderTop: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-md)',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              zIndex: 1100
            }}
          >
            <Button
              variant='primary'
              size='lg'
              startIcon={<ShoppingCartIcon />}
              onClick={() => setCartOpen(true)}
              sx={{ marginInlineEnd: 'auto' }}
            >
              {t('pos:cart.title')}
              {itemCount > 0 && (
                <Box
                  component='span'
                  sx={{
                    marginInlineStart: 1,
                    px: 1,
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--action-accent)',
                    color: 'var(--action-accent-text)',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}
                >
                  {itemCount}
                </Box>
              )}
            </Button>
            <Typography variant='h3' component='span'>
              {formatPKR(total, locale)}
            </Typography>
          </Box>
          <Drawer
            anchor='bottom'
            open={cartOpen}
            onClose={() => setCartOpen(false)}
            title={t('pos:cart.title')}
          >
            <Box sx={{ p: 2, pb: 4 }}>{cartPanel}</Box>
          </Drawer>
          {/* Spacer so the fixed bottom bar doesn't cover the product table */}
          <Box sx={{ height: 80 }} />
        </>
      )}

      <Receipt
        open={receipt.open}
        onClose={() => setReceipt((r) => ({ ...r, open: false }))}
        onNewSale={() => setReceipt((r) => ({ ...r, open: false }))}
        invoiceId={receipt.invoiceId}
        shopName={shopName ?? ''}
        paymentType={receipt.paymentType}
        serviceCharge={receipt.service}
        lines={receipt.lines}
        customerName={receipt.customer}
        total={receipt.total}
        amountPaid={receipt.amountPaid}
        onCredit={receipt.onCredit}
        notes={receipt.notes}
      />

      <OverrideDiscountDialog
        open={overrideOpen}
        onClose={() => setOverrideOpen(false)}
        itemsSubtotal={itemsSubtotal}
        serviceCharge={service}
        // Pre-fill with the current override if set, else the customer's tier %.
        initialValue={override ?? { type: 'percent', value: activeTierPercent }}
        locale={locale}
        onApply={(val) => {
          setOverride(val)
          setOverrideOpen(false)
        }}
        onReset={() => {
          setOverride(null)
          setOverrideOpen(false)
        }}
      />
    </Box>
  )
}

type CartPanelProps = {
  cart: CartItem[]
  dispatch: React.Dispatch<CartAction>
  itemsSubtotal: number
  tierDiscountAmount: number
  activeTierName: string | null
  activeTierPercent: number
  override: OverrideValue | null
  onOpenOverride: () => void
  total: number
  onCredit: number
  service: number
  serviceCharge: string
  setServiceCharge: (s: string) => void
  amountPaidStr: string
  setAmountPaidStr: (s: string) => void
  customerId: string | null
  setCustomerId: (id: string | null) => void
  customerRequired: boolean
  notes: string
  setNotes: (s: string) => void
  submitLabel: string
  submit: () => void
  submitting: boolean
  isSubmittable: boolean
  submitDisabledReason: string | null
  error: string | null
  locale: string
  isMobile: boolean
  onAtMaxAttempt: (stock: number) => void
}

function CartPanel({
  cart,
  dispatch,
  itemsSubtotal,
  tierDiscountAmount,
  activeTierName,
  activeTierPercent,
  override,
  onOpenOverride,
  total,
  onCredit,
  serviceCharge,
  setServiceCharge,
  amountPaidStr,
  setAmountPaidStr,
  customerId,
  setCustomerId,
  customerRequired,
  notes,
  setNotes,
  submitLabel,
  submit,
  submitting,
  isSubmittable,
  submitDisabledReason,
  error,
  locale,
  onAtMaxAttempt
}: CartPanelProps) {
  const { t } = useTranslation(['pos', 'common'])

  return (
    <>
      {cart.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <ShoppingCartIcon
            sx={{ fontSize: 48, color: 'var(--text-disabled)' }}
          />
          <Typography variant='h3' sx={{ mt: 1, color: 'var(--text-primary)' }}>
            {t('pos:cart.empty_title')}
          </Typography>
          <Typography
            variant='body2'
            sx={{
              color: 'var(--text-muted)',
              display: { xs: 'none', md: 'block' }
            }}
          >
            {t('pos:cart.empty_help')}
          </Typography>
          <Typography
            variant='body2'
            sx={{
              color: 'var(--text-muted)',
              display: { xs: 'block', md: 'none' }
            }}
          >
            {t('pos:cart.empty_help_mobile')}
          </Typography>
        </Box>
      ) : (
        <Stack mb={2} divider={<Divider />}>
          {cart.map((c) => {
            const modified = Math.abs(c.price - c.default_price) > 0.001
            const belowCost = c.price < c.avg_cost
            return (
              <Box key={c.product_id} sx={{ py: 1.5 }}>
                <Stack direction='row' spacing={1} alignItems='flex-start'>
                  <Tooltip title={t('pos:cart.remove_line')}>
                    <IconButton
                      size='small'
                      onClick={() =>
                        dispatch({
                          type: 'remove',
                          product_id: c.product_id
                        })
                      }
                      aria-label={t('pos:cart.remove_line')}
                      sx={{ width: 32, height: 32 }}
                    >
                      <CloseIcon fontSize='small' />
                    </IconButton>
                  </Tooltip>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack
                      direction='row'
                      spacing={0.5}
                      alignItems='center'
                      flexWrap='wrap'
                    >
                      <Typography
                        variant='body1'
                        sx={{ fontWeight: 600 }}
                        noWrap
                      >
                        {c.name}
                      </Typography>
                      <Badge variant='neutral' label={c.type} />
                      {modified && (
                        <Badge
                          variant='info'
                          label={t('pos:cart.modified_price_badge')}
                        />
                      )}
                    </Stack>
                    <Typography
                      variant='caption'
                      sx={{ color: 'var(--text-muted)' }}
                    >
                      {t('pos:cart.stock_remaining', {
                        count: c.stock - c.qty
                      })}
                    </Typography>
                  </Box>
                </Stack>

                <Stack
                  direction='row'
                  spacing={1}
                  alignItems='center'
                  mt={1}
                  flexWrap='wrap'
                >
                  <QtyStepper
                    value={c.qty}
                    min={1}
                    max={c.stock}
                    onChange={(qty) =>
                      dispatch({
                        type: 'set_qty',
                        product_id: c.product_id,
                        qty
                      })
                    }
                    onAtMaxAttempt={() => onAtMaxAttempt(c.stock)}
                    ariaLabel={t('pos:cart.qty_label')}
                  />
                  <TextField
                    size='small'
                    type='number'
                    inputProps={{ step: '0.01', min: 0, inputMode: 'numeric' }}
                    value={c.price}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      if (Number.isFinite(v) && v >= 0) {
                        dispatch({
                          type: 'set_price',
                          product_id: c.product_id,
                          price: v
                        })
                      }
                    }}
                    sx={{ width: 110 }}
                    label={t('pos:cart.unit_price')}
                  />
                  <Box sx={{ flex: 1, textAlign: 'end' }}>
                    <Typography
                      variant='overline'
                      sx={{ color: 'var(--text-muted)', display: 'block' }}
                    >
                      {t('pos:cart.line_total')}
                    </Typography>
                    <Typography variant='h3' component='span'>
                      {formatPKR(lineTotal(c), locale)}
                    </Typography>
                  </Box>
                </Stack>
                {modified && (
                  <Typography
                    variant='caption'
                    sx={{
                      color: 'var(--text-muted)',
                      display: 'block',
                      mt: 0.5
                    }}
                  >
                    {t('pos:cart.was_price', {
                      price: formatPKR(c.default_price, locale)
                    })}
                  </Typography>
                )}

                {/* v2.2 per-line discount: collapsed link → inline controls. */}
                <LineDiscountRow
                  item={c}
                  dispatch={dispatch}
                  locale={locale}
                  t={t}
                />

                {belowCost && (
                  <Box sx={{ mt: 0.75 }}>
                    <Banner variant='warning'>
                      {t('pos:cart.below_avg_cost_warning')}
                    </Banner>
                  </Box>
                )}
              </Box>
            )
          })}
        </Stack>
      )}

      {/* Subtotal first, then tier discount (v2.2), then service, then total. */}
      <Stack
        direction='row'
        justifyContent='space-between'
        alignItems='center'
        mb={1}
      >
        <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
          {t('pos:cart.subtotal_products')}
        </Typography>
        <Typography variant='body2'>
          {formatPKR(itemsSubtotal, locale)}
        </Typography>
      </Stack>

      {(tierDiscountAmount > 0 || override !== null) && (
        <Stack
          direction='row'
          justifyContent='space-between'
          alignItems='center'
          mb={1}
        >
          <Stack
            direction='row'
            spacing={0.75}
            alignItems='center'
            flexWrap='wrap'
          >
            <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
              {override
                ? override.type === 'percent'
                  ? t('pos:totals.manual_override_percent', {
                      percent: override.value
                    })
                  : t('pos:totals.manual_override_fixed')
                : activeTierName
                  ? t('pos:totals.tier_discount_with_name', {
                      name: activeTierName,
                      percent: activeTierPercent
                    })
                  : t('pos:totals.tier_discount')}
            </Typography>
            <Button variant='link' size='sm' onClick={onOpenOverride}>
              {t('pos:totals.override_link')}
            </Button>
          </Stack>
          <Typography variant='body2'>
            −{formatPKR(tierDiscountAmount, locale)}
          </Typography>
        </Stack>
      )}

      {tierDiscountAmount === 0 && override === null && (
        <Box sx={{ mb: 1 }}>
          <Button variant='link' size='sm' onClick={onOpenOverride}>
            {t('pos:totals.override_link')}
          </Button>
        </Box>
      )}

      <Field label={t('pos:cart.service_charge')}>
        <Input
          type='number'
          inputProps={{ min: 0, step: '0.01', inputMode: 'numeric' }}
          value={serviceCharge}
          onChange={(e) => setServiceCharge(e.target.value)}
        />
      </Field>

      <Divider sx={{ my: 1.5 }} />

      <Stack
        direction='row'
        justifyContent='space-between'
        alignItems='center'
        mb={1.5}
      >
        <Typography variant='h3' component='span'>
          {t('pos:cart.total')}
        </Typography>
        <Typography variant='h2' component='span'>
          {formatPKR(total, locale)}
        </Typography>
      </Stack>

      <Divider sx={{ my: 1.5 }} />

      <Typography variant='h3' sx={{ mb: 1 }}>
        {t('pos:payment.title')}
      </Typography>

      <Field label={t('pos:payment.amount_paid')}>
        <Input
          type='number'
          inputProps={{
            min: 0,
            max: total,
            step: '0.01',
            inputMode: 'numeric'
          }}
          value={amountPaidStr}
          onChange={(e) => setAmountPaidStr(e.target.value)}
        />
      </Field>
      <Stack direction='row' spacing={1} mt={1} mb={1.5}>
        <Button
          variant='secondary'
          size='sm'
          onClick={() => setAmountPaidStr(total.toFixed(2))}
        >
          {t('pos:payment.pay_full')}
        </Button>
        <Button
          variant='secondary'
          size='sm'
          onClick={() => setAmountPaidStr('0')}
        >
          {t('pos:payment.pay_nothing')}
        </Button>
      </Stack>

      <Stack
        direction='row'
        justifyContent='space-between'
        alignItems='center'
        mb={1.5}
      >
        <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
          {t('pos:payment.on_credit')}
        </Typography>
        <Typography
          variant='body1'
          sx={{
            fontWeight: 700,
            color: onCredit > 0 ? 'var(--warning-700)' : 'var(--text-disabled)'
          }}
        >
          {formatPKR(onCredit, locale)}
        </Typography>
      </Stack>

      <Box sx={{ mb: 1.5 }}>
        <CustomerPicker
          value={customerId}
          onChange={setCustomerId}
          required={customerRequired}
          clearable={!customerRequired}
          label={
            customerRequired
              ? t('pos:payment.customer')
              : t('pos:customer.walk_in')
          }
          errorText={
            customerRequired && !customerId
              ? t('pos:customer.required_for_credit')
              : undefined
          }
        />
      </Box>

      <Field label={t('pos:payment.notes_placeholder')}>
        <Textarea
          minRows={2}
          inputProps={{ maxLength: 1000 }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>

      {error && (
        <Box sx={{ mt: 1.5 }}>
          <Banner variant='error'>{error}</Banner>
        </Box>
      )}

      {submitDisabledReason && !error && (
        <Typography
          variant='caption'
          sx={{
            display: 'block',
            mt: 1.5,
            textAlign: 'center',
            color: 'var(--text-muted)'
          }}
        >
          {submitDisabledReason}
        </Typography>
      )}

      <Button
        variant='primary'
        size='lg'
        fullWidth
        disabled={!isSubmittable}
        loading={submitting}
        onClick={submit}
        sx={{ mt: 1.5 }}
      >
        {submitLabel}
      </Button>
    </>
  )
}

type LineDiscountRowProps = {
  item: CartItem
  dispatch: React.Dispatch<CartAction>
  locale: string
  t: (key: string, opts?: Record<string, unknown>) => string
}

/**
 * Per-line discount UI (spec §5.3). Collapsed: a small "Add discount" link.
 * Expanded: type radio (% / PKR), value input, computed amount, clear (×).
 */
function LineDiscountRow({ item, dispatch, locale, t }: LineDiscountRowProps) {
  const sub = lineSubtotal(item)
  const isOpen = item.line_discount_type !== null
  const amount = lineDiscountAmount(item)

  if (!isOpen) {
    return (
      <Box sx={{ mt: 0.5 }}>
        <Button
          variant='link'
          size='sm'
          onClick={() =>
            dispatch({
              type: 'set_line_discount',
              product_id: item.product_id,
              discount_type: 'percent',
              discount_value: 0
            })
          }
        >
          {t('pos:line.add_discount')}
        </Button>
      </Box>
    )
  }

  const valueExceedsCap =
    item.line_discount_type === 'fixed' &&
    item.line_discount_value !== null &&
    item.line_discount_value > sub

  return (
    <Stack
      direction='row'
      spacing={1}
      alignItems='center'
      mt={0.75}
      flexWrap='wrap'
      sx={{
        backgroundColor: 'var(--surface-muted)',
        p: 1,
        borderRadius: 1
      }}
    >
      <Stack direction='row' spacing={0} alignItems='center'>
        <Button
          variant={item.line_discount_type === 'percent' ? 'primary' : 'ghost'}
          size='sm'
          onClick={() =>
            dispatch({
              type: 'set_line_discount',
              product_id: item.product_id,
              discount_type: 'percent',
              discount_value: item.line_discount_value ?? 0
            })
          }
        >
          {t('pos:line.discount_percent_label')}
        </Button>
        <Button
          variant={item.line_discount_type === 'fixed' ? 'primary' : 'ghost'}
          size='sm'
          onClick={() =>
            dispatch({
              type: 'set_line_discount',
              product_id: item.product_id,
              discount_type: 'fixed',
              discount_value: Math.min(item.line_discount_value ?? 0, sub)
            })
          }
        >
          {t('pos:line.discount_fixed_label')}
        </Button>
      </Stack>
      <TextField
        size='small'
        type='number'
        inputProps={{
          min: 0,
          max: item.line_discount_type === 'percent' ? 100 : sub,
          step: '0.01',
          inputMode: 'decimal'
        }}
        value={item.line_discount_value ?? 0}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (Number.isFinite(v) && v >= 0 && item.line_discount_type) {
            dispatch({
              type: 'set_line_discount',
              product_id: item.product_id,
              discount_type: item.line_discount_type,
              discount_value: v
            })
          }
        }}
        error={valueExceedsCap}
        sx={{ width: 90 }}
        label={t('pos:line.discount_type')}
      />
      <Box sx={{ flex: 1, textAlign: 'end' }}>
        <Typography variant='caption' sx={{ color: 'var(--text-muted)' }}>
          {`${t('pos:line.line_discount')}: −${formatPKR(amount, locale)}`}
        </Typography>
      </Box>
      <IconButton
        size='small'
        aria-label={t('pos:line.remove_discount')}
        onClick={() =>
          dispatch({ type: 'clear_line_discount', product_id: item.product_id })
        }
      >
        <CloseIcon fontSize='small' />
      </IconButton>
    </Stack>
  )
}
