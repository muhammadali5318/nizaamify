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
import { useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { paths } from 'src/paths'
import ProductTable from 'src/features/products/ProductTable'
import type {
  ProductSearchRow,
  ProductVariantRow
} from 'src/features/products/hooks'
import { useRecordSale, usePreflightExpiredSaleCheck } from './hooks'
import { useShopExpiredSaleSettings } from 'src/features/batches/hooks'
import BlockedExpiredSaleDialog, {
  type BlockedExpiredSaleRow
} from './BlockedExpiredSaleDialog'
import ConfirmExpiredSaleDialog, {
  type ExpiredSaleConfirmRow
} from './ConfirmExpiredSaleDialog'
import PosBatchPicker from './PosBatchPicker'
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
import PosProductDrawer from './PosProductDrawer'
import PosVariantPicker from './PosVariantPicker'
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
  /** v2.7: set when the cart line targets a specific variant. Two cart lines
   * for the same product but different variants are distinct lines. Null for
   * single-variant products — record_sale resolves to default variant. */
  variant_id: string | null
  /** v2.7: e.g. "Red / M". Null for single-variant products. */
  variant_label: string | null
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
  /** v2.8.5: true when the product is batched (`products.has_batches`).
   *  Drives the "Pick batch" cart-line affordance. */
  has_batches: boolean
  /** v2.8.5: resolved variant id used by the batch picker hook. For
   *  single-variant cart lines `variant_id` is null by design (server
   *  resolves), but the batch picker needs the default variant id to
   *  query inventory_batches. */
  resolved_variant_id: string | null
  /** v2.8.5: manually-picked batch override. null = FEFO. Carried into
   *  record_sale items + preflight_expired_sale_check. */
  batch_id: string | null
  /** v2.8.5: display strings for the picked batch (batch_no + expiry).
   *  Cached at pick time so we don't refetch on every render. */
  batch_no: string | null
  batch_expiry_date: string | null
}

type AddItem = Omit<
  CartItem,
  | 'qty'
  | 'line_discount_type'
  | 'line_discount_value'
  | 'batch_id'
  | 'batch_no'
  | 'batch_expiry_date'
>

/** Unique key for a cart line: variant_id when present (multi-variant), else
 * product_id. Lets the cart hold two lines for two variants of one product. */
function lineKey(c: { product_id: string; variant_id: string | null }): string {
  return c.variant_id ?? c.product_id
}

type CartAction =
  | { type: 'add'; item: AddItem; qtyDelta?: number }
  | { type: 'set_qty'; key: string; qty: number }
  | { type: 'remove'; key: string }
  | { type: 'set_price'; key: string; price: number }
  | {
      type: 'set_line_discount'
      key: string
      discount_type: DiscountType
      discount_value: number
    }
  | { type: 'clear_line_discount'; key: string }
  | {
      // v2.8.5: manual batch override.
      type: 'set_batch'
      key: string
      batch_id: string
      batch_no: string
      batch_expiry_date: string | null
    }
  | { type: 'clear_batch'; key: string }
  | { type: 'reset' }

function cartReducer(state: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case 'add': {
      const delta = Math.max(1, Math.trunc(action.qtyDelta ?? 1))
      const k = lineKey(action.item)
      const existing = state.find((c) => lineKey(c) === k)
      if (existing) {
        const nextQty = Math.min(existing.qty + delta, existing.stock)
        if (nextQty === existing.qty) return state
        return state.map((c) => (lineKey(c) === k ? { ...c, qty: nextQty } : c))
      }
      return [
        ...state,
        {
          ...action.item,
          qty: Math.min(delta, action.item.stock),
          line_discount_type: null,
          line_discount_value: null,
          batch_id: null,
          batch_no: null,
          batch_expiry_date: null
        }
      ]
    }
    case 'set_qty': {
      return state.map((c) =>
        lineKey(c) === action.key
          ? {
              ...c,
              qty: Math.max(1, Math.min(c.stock, Math.trunc(action.qty)))
            }
          : c
      )
    }
    case 'remove':
      return state.filter((c) => lineKey(c) !== action.key)
    case 'set_price':
      return state.map((c) =>
        lineKey(c) === action.key ? { ...c, price: action.price } : c
      )
    case 'set_line_discount':
      return state.map((c) =>
        lineKey(c) === action.key
          ? {
              ...c,
              line_discount_type: action.discount_type,
              line_discount_value: action.discount_value
            }
          : c
      )
    case 'clear_line_discount':
      return state.map((c) =>
        lineKey(c) === action.key
          ? {
              ...c,
              line_discount_type: null,
              line_discount_value: null
            }
          : c
      )
    case 'set_batch':
      return state.map((c) =>
        lineKey(c) === action.key
          ? {
              ...c,
              batch_id: action.batch_id,
              batch_no: action.batch_no,
              batch_expiry_date: action.batch_expiry_date
            }
          : c
      )
    case 'clear_batch':
      return state.map((c) =>
        lineKey(c) === action.key
          ? { ...c, batch_id: null, batch_no: null, batch_expiry_date: null }
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

  const navigate = useNavigate()
  const { data: shopName } = useShopName()
  const { data: shopExpiredSettings } = useShopExpiredSaleSettings()
  const recordSale = useRecordSale()
  const preflightExpired = usePreflightExpiredSaleCheck()
  const [blockDialog, setBlockDialog] = useState<{
    open: boolean
    rows: BlockedExpiredSaleRow[]
  }>({ open: false, rows: [] })
  const [warnDialog, setWarnDialog] = useState<{
    open: boolean
    rows: ExpiredSaleConfirmRow[]
  }>({ open: false, rows: [] })

  const [cart, dispatch] = useReducer(cartReducer, [])
  const [serviceCharge, setServiceCharge] = useState('0')
  // null = "follow total" (default cash). Any string = the user has typed
  // (or pressed Pay full/Pay nothing) and the amount sticks until cleared.
  // Using a derived `amountPaid` instead of a useEffect-synced string
  // eliminates the one-render flicker where adding an item would briefly
  // show "customer required for credit" before the effect updated.
  const [amountPaidOverride, setAmountPaidOverride] = useState<string | null>(
    null
  )
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
    /** v2.8.4: opted-in shops show a disclaimer footer when any line was
     *  drawn from an expired batch. Computed from sale_items after the
     *  RPC returns. */
    showExpiredDisclaimer: boolean
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
    notes: '',
    showExpiredDisclaimer: false
  })
  const [error, setError] = useState<string | null>(null)

  // ---- v2.3 discount math ----
  // items_subtotal: sum of line totals (after per-line discounts).
  const itemsSubtotal = round2(cart.reduce((s, c) => s + lineTotal(c), 0))
  const service = Math.max(0, Number(serviceCharge) || 0)

  // v2.3: sale-time discount is *manual only* — set via the popup. Customer
  // tier no longer auto-discounts.
  const [saleDiscount, setSaleDiscount] = useState<OverrideValue | null>(null)
  const [overrideOpen, setOverrideOpen] = useState(false)
  /** v2.5 §1.3: product detail drawer. The id alone is enough — the drawer
   * fetches the product via useProduct, which keeps the cart untouched
   * regardless of detail-page state. */
  const [drawerProductId, setDrawerProductId] = useState<string | null>(null)
  /** v2.7: when set, the variant picker dialog is open for this product row. */
  const [variantPickerRow, setVariantPickerRow] =
    useState<ProductSearchRow | null>(null)

  // Tier list is still read so we can show the tier chip on the customer card.
  const { data: tiers = [] } = useTiers()
  const { data: selectedCustomer } = useCustomer(customerId ?? undefined)
  const customerTier = selectedCustomer?.tier_id
    ? tiers.find((t2) => t2.id === selectedCustomer.tier_id)
    : null

  // Clear any in-progress sale discount when the customer changes — discounts
  // are per-sale and should not persist across distinct customers.
  useEffect(() => {
    setSaleDiscount(null)
  }, [customerId])

  const saleDiscountAmount = saleDiscount
    ? saleDiscount.type === 'percent'
      ? round2((itemsSubtotal * saleDiscount.value) / 100)
      : Math.min(round2(saleDiscount.value), itemsSubtotal)
    : 0

  const total = round2(itemsSubtotal - saleDiscountAmount + service)
  // No override → cash sale (amount paid follows total). Override set →
  // user-driven (Pay nothing, partial, etc.) and clamped to current total.
  const amountPaid =
    amountPaidOverride === null
      ? total
      : Math.min(Math.max(0, Number(amountPaidOverride) || 0), total)
  const amountPaidDisplay =
    amountPaidOverride === null ? total.toFixed(2) : amountPaidOverride
  const onCredit = Math.max(0, total - amountPaid)
  const itemCount = cart.reduce((s, c) => s + c.qty, 0)

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
    const existing = cart.find(
      (c) => c.product_id === row.id && c.variant_id === null
    )
    const currentQty = existing?.qty ?? 0
    if (currentQty + qtyDelta > row.stock) {
      notify.warning(t('pos:picker.stock_capped', { count: row.stock }))
    }
    dispatch({
      type: 'add',
      qtyDelta,
      item: {
        product_id: row.id,
        variant_id: null,
        variant_label: null,
        name: row.name,
        type: row.type,
        default_price: Number(row.price),
        price: Number(row.price),
        avg_cost: Number(row.avg_cost),
        stock: row.stock,
        has_batches: row.has_batches,
        resolved_variant_id: row.default_variant_id ?? null
      }
    })
  }

  /**
   * v2.7: add a specific variant of a multi-variant product to the cart.
   * Different variants of the same product are separate cart lines (lineKey
   * dedupes by variant_id when present).
   */
  const handleAddVariant = (
    row: ProductSearchRow,
    variant: ProductVariantRow
  ) => {
    if (variant.stock <= 0) return
    if (variant.price === null) return
    dispatch({
      type: 'add',
      qtyDelta: 1,
      item: {
        product_id: row.id,
        variant_id: variant.variant_id,
        variant_label: variant.variant_label,
        name: row.name,
        type: row.type,
        default_price: Number(variant.price),
        price: Number(variant.price),
        avg_cost: Number(variant.avg_cost),
        stock: variant.stock,
        has_batches: row.has_batches,
        resolved_variant_id: variant.variant_id
      }
    })
  }

  /** Drawer "Add to cart" button. We don't have a ProductSearchRow handy here,
   * so adapt from the product table's latest data by id — or fall back to a
   * one-shot fetch via `from('products')`. The drawer body has the product
   * cached via useProduct, so the row lookup is fast. */
  const handleAddProductById = async (productId: string) => {
    const cached = cart.find(
      (c) => c.product_id === productId && c.variant_id === null
    )
    if (cached) {
      handleAddProduct(
        {
          id: cached.product_id,
          name: cached.name,
          type: cached.type,
          category_id: '',
          description: null,
          price: cached.default_price,
          avg_cost: cached.avg_cost,
          last_purchase_cost: null,
          stock: cached.stock,
          is_active: true,
          relevance: 0,
          has_variants: false,
          variant_count: 1,
          min_price: cached.default_price,
          max_price: cached.default_price,
          total_stock_all_variants: cached.stock,
          has_null_price_variant: false,
          has_batches: cached.has_batches,
          default_variant_id: cached.resolved_variant_id
        },
        1
      )
      return
    }
    const { data, error } = await supabase
      .from('product_with_default_variant')
      .select(
        'product_id, name, legacy_type_column, category_id, price, avg_cost, stock, product_is_active, has_batches, variant_id'
      )
      .eq('product_id', productId)
      .single()
    if (error || !data) return
    handleAddProduct(
      {
        id: data.product_id as string,
        name: data.name as string,
        type: (data.legacy_type_column as string) ?? '',
        category_id: data.category_id as string,
        description: null,
        price: Number(data.price ?? 0),
        avg_cost: Number(data.avg_cost ?? 0),
        last_purchase_cost: null,
        stock: (data.stock as number) ?? 0,
        is_active: !!data.product_is_active,
        relevance: 0,
        has_variants: false,
        variant_count: 1,
        min_price: Number(data.price ?? 0),
        max_price: Number(data.price ?? 0),
        total_stock_all_variants: (data.stock as number) ?? 0,
        has_null_price_variant: false,
        has_batches: !!data.has_batches,
        default_variant_id: (data.variant_id as string | null) ?? null
      },
      1
    )
  }

  /** Builds the `record_sale` items payload from the current cart. */
  const buildItemsPayload = () =>
    cart.map((c) => ({
      ...(c.variant_id
        ? { variant_id: c.variant_id }
        : { product_id: c.product_id }),
      qty: c.qty,
      price_at_sale: c.price,
      // v2.2: omit line_discount fields when no discount on this line so the
      // server stores NULL/0 (matches the consistency check).
      line_discount_type: c.line_discount_type,
      line_discount_value: c.line_discount_value,
      // v2.8.5: manually-picked batch override. null = FEFO.
      ...(c.batch_id ? { batch_id: c.batch_id } : {})
    }))

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

    // v2.8.4 preflight — ask the server which lines (if any) would draw
    // from expired stock and what each variant's effective policy is.
    if (cart.length > 0) {
      try {
        const preflightItems = cart.map((c) => ({
          ...(c.variant_id
            ? { variant_id: c.variant_id }
            : { product_id: c.product_id }),
          qty: c.qty,
          // v2.8.5: include the manually-picked batch_id so the preflight
          // checks the specific batch (manual override path) instead of
          // computing the FEFO non-expired sum.
          ...(c.batch_id ? { batch_id: c.batch_id } : {})
        }))
        const rows = await preflightExpired.mutateAsync({
          items: preflightItems
        })
        const labelFor = (variantId: string) => {
          const cartLine = cart.find(
            (c) => (c.variant_id ?? null) === variantId
          )
          if (cartLine) {
            return cartLine.variant_label
              ? `${cartLine.name} — ${cartLine.variant_label}`
              : cartLine.name
          }
          // Fallback for single-variant items: the preflight returns the
          // resolved default variant_id; match by product_id via cart.
          const fallback = cart.find((c) => c.variant_id === null)
          return fallback?.name ?? ''
        }
        const cartLineFor = (variantId: string) => {
          // For single-variant items the cart line has variant_id=null;
          // preflight returns the resolved variant. We match all cart
          // lines whose variant matches; if none, fall back to the
          // single-variant index in this preflight row's order.
          const direct = cart.find((c) => (c.variant_id ?? null) === variantId)
          return direct ?? null
        }
        const blockedRows: BlockedExpiredSaleRow[] = []
        const warnRows: ExpiredSaleConfirmRow[] = []
        rows.forEach((r, idx) => {
          if (!r.would_draw_expired) return
          // Map back to cart line for label + qty + product_id.
          const direct = cartLineFor(r.variant_id)
          const cartLine = direct ?? cart[idx] ?? null
          const productLabel = direct
            ? labelFor(r.variant_id)
            : cartLine
              ? cartLine.variant_label
                ? `${cartLine.name} — ${cartLine.variant_label}`
                : cartLine.name
              : ''
          const qty = cartLine?.qty ?? 0
          if (r.policy === 'block') {
            blockedRows.push({
              productLabel,
              qty,
              productId: cartLine?.product_id ?? null
            })
          } else if (r.policy === 'warn') {
            warnRows.push({ productLabel, qty })
          }
          // policy === 'allow' is a silent pass; no dialog needed.
        })
        if (blockedRows.length > 0) {
          setBlockDialog({ open: true, rows: blockedRows })
          return
        }
        if (warnRows.length > 0) {
          setWarnDialog({ open: true, rows: warnRows })
          return
        }
      } catch (err) {
        // Preflight failure is not blocking — fall through to record_sale,
        // which still enforces the policy server-side and will raise if
        // confirmation is missing.

        console.warn('preflight_expired_sale_check failed', err)
      }
    }

    await performRecordSale(false)
  }

  /** Performs the actual record_sale RPC call. Split out so the warn-mode
   *  confirmation dialog can re-invoke it with `confirmExpired = true`. */
  const performRecordSale = async (confirmExpired: boolean) => {
    setError(null)
    try {
      const items = buildItemsPayload()
      const invoiceId = await recordSale.mutateAsync({
        customer_id: customerId,
        amount_paid: amountPaid,
        service_charge: service,
        notes: notes.trim() || null,
        items,
        sale_discount_type: saleDiscount?.type ?? null,
        sale_discount_value: saleDiscount?.value ?? null,
        confirm_expired_sale: confirmExpired
      })
      const invoiceIdStr = invoiceId as unknown as string
      // v2.8.4: surface the receipt disclaimer when the shop has opted in
      // AND at least one sale_items line was drawn from expired stock.
      let showExpiredDisclaimer = false
      if (shopExpiredSettings?.expired_sale_receipt_disclaimer) {
        const { count } = await supabase
          .from('sale_items')
          .select('id', { count: 'exact', head: true })
          .eq('invoice_id', invoiceIdStr)
          .eq('sold_expired', true)
        showExpiredDisclaimer = (count ?? 0) > 0
      }
      setReceipt({
        open: true,
        invoiceId: invoiceIdStr,
        lines: cart.map((c) => ({
          key: lineKey(c),
          name: c.variant_label ? `${c.name} — ${c.variant_label}` : c.name,
          qty: c.qty,
          price: c.price
        })),
        paymentType,
        service,
        total,
        amountPaid,
        onCredit,
        customer: selectedCustomer?.name,
        notes: notes.trim(),
        showExpiredDisclaimer
      })
      dispatch({ type: 'reset' })
      setServiceCharge('0')
      setCustomerId(null)
      setNotes('')
      setSaleDiscount(null)
      setAmountPaidOverride(null)
      setCartOpen(false)
      setBlockDialog({ open: false, rows: [] })
      setWarnDialog({ open: false, rows: [] })
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
      } else if (msg.includes('sale_discount_percent_out_of_range')) {
        setError(t('pos:errors.sale_discount_percent_out_of_range'))
      } else if (msg.includes('sale_discount_fixed_exceeds_items_subtotal')) {
        setError(t('pos:errors.sale_discount_fixed_exceeds_items'))
      } else if (msg.includes('expired_stock_blocked')) {
        // Server-side rejection of a manual override to an expired batch
        // in block-policy mode. Surface as a block-style banner since the
        // preflight should normally have caught this.
        setError(t('pos:expired_sale.block_dialog_writeoff_hint'))
      } else if (msg.includes('insufficient_non_expired_stock')) {
        setError(t('pos:expired_sale.block_dialog_writeoff_hint'))
      } else if (msg.includes('expired_stock_needs_confirmation')) {
        // Preflight result raced with a concurrent sale — re-open the warn
        // dialog. Reuse the warn rows if we have any; otherwise build a
        // generic single-row prompt.
        setWarnDialog((prev) =>
          prev.rows.length > 0
            ? { ...prev, open: true }
            : {
                open: true,
                rows: cart.map((c) => ({
                  productLabel: c.variant_label
                    ? `${c.name} — ${c.variant_label}`
                    : c.name,
                  qty: c.qty
                }))
              }
        )
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
      saleDiscountAmount={saleDiscountAmount}
      saleDiscount={saleDiscount}
      onOpenOverride={() => setOverrideOpen(true)}
      total={total}
      onCredit={onCredit}
      service={service}
      serviceCharge={serviceCharge}
      setServiceCharge={setServiceCharge}
      amountPaidDisplay={amountPaidDisplay}
      setAmountPaidOverride={setAmountPaidOverride}
      customerId={customerId}
      setCustomerId={setCustomerId}
      customerName={selectedCustomer?.name ?? null}
      customerTierName={customerTier?.name ?? null}
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
            showViewIcon
            onView={(row) => setDrawerProductId(row.id)}
            actionsHeader={t('pos:picker.add_column_header')}
            actionsAlign='center'
            renderActions={(row, breakdown) => {
              // v2.3 §6.3.2/§6.3.3 (revised): all "add to cart" affordances
              // live in the rightmost column. Primary [+] sits on top; pack
              // quick-add chips stack vertically below it as secondary
              // buttons. (v2.6c: scan-only UI was retired — the column is
              // kept in DB for future use but no longer rendered.)
              const packs = breakdown?.pack_breakdown ?? []
              return (
                <Stack
                  spacing={0.5}
                  alignItems='center'
                  sx={{ width: '100%' }}
                  // Stop the click from bubbling up to the row's onView so
                  // the + button (and quick-add chips) don't also open the
                  // detail drawer.
                  onClick={(e) => e.stopPropagation()}
                >
                  {row.has_variants ? (
                    // v2.7 §8.1: multi-variant products show a "Pick variant"
                    // button instead of a direct add — clicking opens the
                    // PosVariantPicker, which then dispatches the variant-aware
                    // add via handleAddVariant.
                    <Button
                      variant='secondary'
                      size='sm'
                      onClick={() => setVariantPickerRow(row)}
                    >
                      {t('pos:picker.pick_variant')}
                    </Button>
                  ) : (
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
                              backgroundColor: 'var(--surface-muted)',
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
                          sx={{ minWidth: 'auto', whiteSpace: 'nowrap' }}
                        >
                          {`+1 ${p.unit_name} (${p.base_qty})`}
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
          <Box sx={{ width: 440, flexShrink: 0 }}>
            <Card variant='elevated' noPadding>
              <Box sx={{ p: 2, backgroundColor: 'var(--surface-subtle)' }}>
                {cartPanel}
              </Box>
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
        showExpiredDisclaimer={receipt.showExpiredDisclaimer}
      />

      <OverrideDiscountDialog
        open={overrideOpen}
        onClose={() => setOverrideOpen(false)}
        itemsSubtotal={itemsSubtotal}
        serviceCharge={service}
        // v2.3: no auto-tier seeding. Pre-fill with the current value (if any),
        // otherwise default to a 0% discount that the user can adjust.
        initialValue={saleDiscount ?? { type: 'percent', value: 0 }}
        locale={locale}
        onApply={(val) => {
          setSaleDiscount(val)
          setOverrideOpen(false)
        }}
        onReset={() => {
          setSaleDiscount(null)
          setOverrideOpen(false)
        }}
      />

      <PosProductDrawer
        productId={drawerProductId}
        onClose={() => setDrawerProductId(null)}
        onAddToCart={(productId) => {
          void handleAddProductById(productId)
        }}
      />

      <PosVariantPicker
        open={variantPickerRow !== null}
        productId={variantPickerRow?.id ?? null}
        productName={variantPickerRow?.name ?? ''}
        onClose={() => setVariantPickerRow(null)}
        onAdd={(variant) => {
          if (!variantPickerRow) return
          handleAddVariant(variantPickerRow, variant)
          setVariantPickerRow(null)
        }}
      />

      <BlockedExpiredSaleDialog
        open={blockDialog.open}
        onClose={() => setBlockDialog({ open: false, rows: [] })}
        rows={blockDialog.rows}
        onOpenProduct={(productId) => {
          // eslint-disable-next-line no-console
          console.info('[v2.8.4] navigating to product', productId)
          setBlockDialog({ open: false, rows: [] })
          // Defer the navigate one tick so the dialog's exit animation
          // can't race the route change (some MUI builds swallow the
          // route push if it fires while the modal portal is unmounting).
          setTimeout(() => navigate(paths.gotoProduct(productId)), 0)
        }}
      />

      <ConfirmExpiredSaleDialog
        open={warnDialog.open}
        onClose={() => setWarnDialog({ open: false, rows: [] })}
        rows={warnDialog.rows}
        submitting={recordSale.isPending}
        onConfirm={() => {
          void performRecordSale(true)
        }}
      />
    </Box>
  )
}

type CartPanelProps = {
  cart: CartItem[]
  dispatch: React.Dispatch<CartAction>
  itemsSubtotal: number
  saleDiscountAmount: number
  saleDiscount: OverrideValue | null
  onOpenOverride: () => void
  total: number
  onCredit: number
  service: number
  serviceCharge: string
  setServiceCharge: (s: string) => void
  amountPaidDisplay: string
  setAmountPaidOverride: (s: string | null) => void
  customerId: string | null
  setCustomerId: (id: string | null) => void
  customerName: string | null
  customerTierName: string | null
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
  saleDiscountAmount,
  saleDiscount,
  onOpenOverride,
  total,
  onCredit,
  serviceCharge,
  setServiceCharge,
  amountPaidDisplay,
  setAmountPaidOverride,
  customerId,
  setCustomerId,
  customerName,
  customerTierName,
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
  const { t } = useTranslation(['pos', 'batches', 'common'])
  // v2.8.5: which cart-line currently has the batch picker open. lineKey
  // identifies the row; null means closed.
  const [batchPickerForKey, setBatchPickerForKey] = useState<string | null>(
    null
  )
  const batchPickerLine = batchPickerForKey
    ? (cart.find((c) => lineKey(c) === batchPickerForKey) ?? null)
    : null

  return (
    <>
      {/* Customer card pinned at the top of the cart panel (spec §1.2/§5.6).
          Walk-in shows the picker; a real customer shows name + tier chip. */}
      <Box sx={{ mb: 1.5 }}>
        {customerId && customerName ? (
          <Stack
            direction='row'
            spacing={1}
            alignItems='center'
            sx={{
              p: 1,
              borderRadius: 1,
              backgroundColor: 'var(--surface-muted)'
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack
                direction='row'
                spacing={0.75}
                alignItems='center'
                flexWrap='wrap'
              >
                <Typography variant='body1' sx={{ fontWeight: 600 }} noWrap>
                  {customerName}
                </Typography>
                {customerTierName && (
                  <Badge variant='info' label={customerTierName} />
                )}
              </Stack>
            </Box>
            <Tooltip title={t('pos:customer.switch_to_walk_in')}>
              <IconButton
                size='small'
                onClick={() => setCustomerId(null)}
                aria-label={t('pos:customer.switch_to_walk_in')}
              >
                <CloseIcon fontSize='small' />
              </IconButton>
            </Tooltip>
          </Stack>
        ) : (
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
        )}
      </Box>

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
        // Card-style cart lines. Each line is self-labeling, so the legacy
        // column headers above the list have been retired (v2.3 follow-up):
        //   - Product name leads, wraps freely (no `noWrap` truncation).
        //   - Line total anchors top-right as the visual focus.
        //   - × removal sits next to the total — same gestalt: "this much, or
        //     not at all".
        //   - Controls sit below a hairline divider with inline captions.
        // Same layout from 320 px to 1200 px, no responsive split needed.
        <Stack spacing={1.25} mb={2}>
          {cart.map((c) => {
            const modified = Math.abs(c.price - c.default_price) > 0.001
            const belowCost = c.price < c.avg_cost
            const stockLeft = c.stock - c.qty
            return (
              <Box
                key={c.product_id}
                sx={{
                  backgroundColor: 'var(--surface-base)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-xs)',
                  p: 1.75,
                  transition:
                    'border-color var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out)',
                  '&:focus-within': {
                    borderColor: 'var(--border-focus)',
                    boxShadow: 'var(--shadow-sm)'
                  }
                }}
              >
                {/* Header strip: name (wraps) | line total | × */}
                <Stack
                  direction='row'
                  spacing={1.25}
                  alignItems='flex-start'
                  sx={{ minWidth: 0 }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant='body1'
                      sx={{
                        fontWeight: 600,
                        lineHeight: 1.3,
                        // explicitly override any inherited noWrap; long
                        // product names wrap to multiple lines instead of
                        // truncating with an ellipsis.
                        whiteSpace: 'normal',
                        wordBreak: 'break-word'
                      }}
                    >
                      {c.variant_label
                        ? `${c.name} — ${c.variant_label}`
                        : c.name}
                    </Typography>
                    <Stack
                      direction='row'
                      spacing={0.5}
                      alignItems='center'
                      flexWrap='wrap'
                      rowGap={0.5}
                      sx={{ mt: 0.5 }}
                    >
                      <Badge variant='neutral' label={c.type} />
                      {modified && (
                        <Badge
                          variant='info'
                          label={t('pos:cart.modified_price_badge')}
                        />
                      )}
                      <Typography
                        variant='caption'
                        sx={{
                          color:
                            stockLeft <= 0
                              ? 'var(--status-warning-text)'
                              : 'var(--text-muted)'
                        }}
                      >
                        {`· ${t('pos:cart.stock_remaining', {
                          count: stockLeft
                        })}`}
                      </Typography>
                    </Stack>
                  </Box>

                  <Stack
                    direction='row'
                    spacing={0.5}
                    alignItems='center'
                    sx={{ flexShrink: 0 }}
                  >
                    <Typography
                      variant='h3'
                      component='span'
                      sx={{
                        fontVariantNumeric: 'tabular-nums',
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {formatPKR(lineTotal(c), locale)}
                    </Typography>
                    <Tooltip title={t('pos:cart.remove_line')}>
                      <IconButton
                        size='small'
                        onClick={() =>
                          dispatch({
                            type: 'remove',
                            key: lineKey(c)
                          })
                        }
                        aria-label={t('pos:cart.remove_line')}
                        sx={{
                          width: 28,
                          height: 28,
                          color: 'var(--text-muted)',
                          '&:hover': {
                            color: 'var(--status-error-text)',
                            backgroundColor: 'var(--surface-muted)'
                          }
                        }}
                      >
                        <CloseIcon fontSize='small' />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>

                <Divider
                  sx={{ my: 1.25, borderColor: 'var(--border-subtle)' }}
                />

                {/* Controls strip: Qty stepper + Price input, each with
                    inline caption. flex-wraps if the cart panel is narrow. */}
                <Stack
                  direction='row'
                  spacing={1.5}
                  alignItems='center'
                  flexWrap='wrap'
                  rowGap={1}
                >
                  <Stack
                    direction='row'
                    spacing={1}
                    alignItems='center'
                    sx={{ flexShrink: 0 }}
                  >
                    <Typography
                      variant='caption'
                      sx={{
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}
                    >
                      {t('pos:cart.col_qty')}
                    </Typography>
                    <QtyStepper
                      value={c.qty}
                      min={1}
                      max={c.stock}
                      onChange={(qty) =>
                        dispatch({
                          type: 'set_qty',
                          key: lineKey(c),
                          qty
                        })
                      }
                      onAtMaxAttempt={() => onAtMaxAttempt(c.stock)}
                      ariaLabel={t('pos:cart.qty_label')}
                    />
                  </Stack>

                  <Stack
                    direction='row'
                    spacing={1}
                    alignItems='center'
                    sx={{ flex: 1, minWidth: 140, justifyContent: 'flex-end' }}
                  >
                    <Typography
                      variant='caption'
                      sx={{
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}
                    >
                      {t('pos:cart.col_price')}
                    </Typography>
                    <TextField
                      size='small'
                      type='number'
                      inputProps={{
                        step: '0.01',
                        min: 0,
                        inputMode: 'numeric',
                        style: {
                          textAlign: 'end',
                          fontVariantNumeric: 'tabular-nums'
                        }
                      }}
                      value={c.price}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        if (Number.isFinite(v) && v >= 0) {
                          dispatch({
                            type: 'set_price',
                            key: lineKey(c),
                            price: v
                          })
                        }
                      }}
                      sx={{ width: 120 }}
                      aria-label={t('pos:cart.unit_price')}
                    />
                  </Stack>
                </Stack>

                {modified && (
                  <Typography
                    variant='caption'
                    sx={{
                      color: 'var(--text-muted)',
                      display: 'block',
                      mt: 0.75,
                      textAlign: 'end'
                    }}
                  >
                    {t('pos:cart.was_price', {
                      price: formatPKR(c.default_price, locale)
                    })}
                  </Typography>
                )}

                <LineDiscountRow
                  item={c}
                  dispatch={dispatch}
                  locale={locale}
                  t={t}
                />

                {/* v2.8.5: Pick batch affordance — visible only when the
                 *  product is batched. Renders the picked batch_no + EXPIRED
                 *  badge when an override is active. Cart lines without a
                 *  manual pick let FEFO decide server-side. */}
                {c.has_batches && (
                  <Stack
                    direction='row'
                    spacing={0.75}
                    alignItems='center'
                    flexWrap='wrap'
                    sx={{ mt: 0.75 }}
                  >
                    <Typography
                      variant='caption'
                      sx={{
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}
                    >
                      {t('pos:cart.batch_label')}
                    </Typography>
                    {c.batch_id ? (
                      <>
                        <Typography
                          variant='caption'
                          sx={{
                            fontFamily: 'monospace',
                            color: 'var(--text-primary)'
                          }}
                        >
                          {c.batch_no}
                        </Typography>
                        {c.batch_expiry_date &&
                          new Date(c.batch_expiry_date).setHours(0, 0, 0, 0) <
                            new Date().setHours(0, 0, 0, 0) && (
                            <Badge
                              variant='error'
                              label={t('pos:cart.batch_expired_label')}
                            />
                          )}
                        <Button
                          variant='link'
                          size='sm'
                          onClick={() => setBatchPickerForKey(lineKey(c))}
                        >
                          {t('pos:cart.pick_batch')}
                        </Button>
                        <Button
                          variant='link'
                          size='sm'
                          onClick={() =>
                            dispatch({
                              type: 'clear_batch',
                              key: lineKey(c)
                            })
                          }
                        >
                          {t('pos:cart.reset_to_fefo')}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Typography
                          variant='caption'
                          sx={{ color: 'var(--text-muted)' }}
                        >
                          {t('pos:cart.batch_oldest')}
                        </Typography>
                        <Button
                          variant='link'
                          size='sm'
                          onClick={() => setBatchPickerForKey(lineKey(c))}
                          disabled={!c.resolved_variant_id}
                        >
                          {t('pos:cart.pick_batch')}
                        </Button>
                      </>
                    )}
                  </Stack>
                )}

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

      {/* v2.8.5: single picker dialog reused across cart lines — opened
       *  from any batched line's "Pick batch" link. */}
      <PosBatchPicker
        open={batchPickerLine !== null}
        onClose={() => setBatchPickerForKey(null)}
        variantId={batchPickerLine?.resolved_variant_id ?? null}
        productName={
          batchPickerLine
            ? batchPickerLine.variant_label
              ? `${batchPickerLine.name} — ${batchPickerLine.variant_label}`
              : batchPickerLine.name
            : ''
        }
        currentBatchId={batchPickerLine?.batch_id ?? null}
        requiredQty={batchPickerLine?.qty ?? 1}
        onPick={(picked) => {
          if (!batchPickerLine) return
          dispatch({
            type: 'set_batch',
            key: lineKey(batchPickerLine),
            batch_id: picked.batch_id,
            batch_no: picked.batch_no,
            batch_expiry_date: picked.batch_expiry_date
          })
        }}
        onResetToFefo={() => {
          if (!batchPickerLine) return
          dispatch({ type: 'clear_batch', key: lineKey(batchPickerLine) })
        }}
      />

      {/* Subtotal first, then sale discount (v2.3 manual only), then service. */}
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

      {saleDiscount !== null && saleDiscountAmount > 0 && (
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
              {saleDiscount.type === 'percent'
                ? t('pos:totals.sale_discount_percent', {
                    percent: saleDiscount.value
                  })
                : t('pos:totals.sale_discount_fixed')}
            </Typography>
            <Button variant='link' size='sm' onClick={onOpenOverride}>
              {t('pos:totals.edit_discount_link')}
            </Button>
          </Stack>
          <Typography variant='body2'>
            −{formatPKR(saleDiscountAmount, locale)}
          </Typography>
        </Stack>
      )}

      {(saleDiscount === null || saleDiscountAmount === 0) && (
        <Box sx={{ mb: 1 }}>
          <Button variant='link' size='sm' onClick={onOpenOverride}>
            {t('pos:totals.apply_discount_link')}
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
          value={amountPaidDisplay}
          onChange={(e) => setAmountPaidOverride(e.target.value)}
        />
      </Field>
      <Stack direction='row' spacing={1} mt={1} mb={1.5}>
        <Button
          variant='secondary'
          size='sm'
          onClick={() => setAmountPaidOverride(null)}
        >
          {t('pos:payment.pay_full')}
        </Button>
        <Button
          variant='secondary'
          size='sm'
          onClick={() => setAmountPaidOverride('0')}
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
            color:
              onCredit > 0
                ? 'var(--status-warning-text)'
                : 'var(--text-disabled)'
          }}
        >
          {formatPKR(onCredit, locale)}
        </Typography>
      </Stack>

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
              key: lineKey(item),
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
              key: lineKey(item),
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
              key: lineKey(item),
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
              key: lineKey(item),
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
          dispatch({ type: 'clear_line_discount', key: lineKey(item) })
        }
      >
        <CloseIcon fontSize='small' />
      </IconButton>
    </Stack>
  )
}
