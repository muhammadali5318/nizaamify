import { useEffect, useMemo, useReducer, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material'
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

type CartItem = {
  product_id: string
  name: string
  type: string
  default_price: number
  price: number
  qty: number
  avg_cost: number
  stock: number
}

type AddItem = Omit<CartItem, 'qty'>

type CartAction =
  | { type: 'add'; item: AddItem }
  | { type: 'set_qty'; product_id: string; qty: number }
  | { type: 'remove'; product_id: string }
  | { type: 'set_price'; product_id: string; price: number }
  | { type: 'reset' }

function cartReducer(state: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case 'add': {
      const existing = state.find(
        (c) => c.product_id === action.item.product_id
      )
      if (existing) {
        if (existing.qty >= existing.stock) return state
        return state.map((c) =>
          c.product_id === action.item.product_id ? { ...c, qty: c.qty + 1 } : c
        )
      }
      return [...state, { ...action.item, qty: 1 }]
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
    case 'reset':
      return []
  }
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

  const { data: shopName } = useShopName()
  const recordSale = useRecordSale()

  const [cart, dispatch] = useReducer(cartReducer, [])
  const [serviceCharge, setServiceCharge] = useState('0')
  const [amountPaidStr, setAmountPaidStr] = useState('0')
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
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

  const subtotal = cart.reduce((s, c) => s + c.qty * c.price, 0)
  const service = Math.max(0, Number(serviceCharge) || 0)
  const total = subtotal + service
  const amountPaid = Math.min(Math.max(0, Number(amountPaidStr) || 0), total)
  const onCredit = Math.max(0, total - amountPaid)

  // Default amount_paid to total when total changes (sane "cash" default).
  useEffect(() => {
    setAmountPaidStr(total.toFixed(2))
  }, [total])

  const paymentType: 'cash' | 'credit' | 'partial' =
    onCredit === 0 ? 'cash' : amountPaid === 0 ? 'credit' : 'partial'

  const customerRequired = onCredit > 0
  const { data: selectedCustomer } = useCustomer(customerId ?? undefined)

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

  const handleAddProduct = (row: ProductSearchRow) => {
    if (row.stock <= 0) return
    const existing = cart.find((c) => c.product_id === row.id)
    if (existing && existing.qty >= row.stock) {
      notify.warning(t('pos:picker.stock_capped', { count: row.stock }))
      return
    }
    dispatch({
      type: 'add',
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
        price_at_sale: c.price
      }))
      const invoiceId = await recordSale.mutateAsync({
        customer_id: customerId,
        amount_paid: amountPaid,
        service_charge: service,
        notes: notes.trim() || null,
        items
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
      } else {
        setError(t('pos:errors.submit_failed'))
      }
    }
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant='h5' fontWeight={700} mb={2}>
        {t('pos:title')}
      </Typography>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        alignItems='flex-start'
      >
        <Box sx={{ flex: 1, width: '100%', minWidth: 0 }}>
          <ProductTable
            onlyInStock
            showAvgCost
            renderActions={(row) => (
              <Tooltip title={t('pos:picker.add_to_cart')}>
                <span>
                  <IconButton
                    color='primary'
                    onClick={() => handleAddProduct(row)}
                    disabled={row.stock <= 0}
                    sx={{
                      width: 40,
                      height: 40,
                      border: '1px solid',
                      borderColor: 'primary.main'
                    }}
                    aria-label={t('pos:picker.add_to_cart')}
                  >
                    <AddIcon />
                  </IconButton>
                </span>
              </Tooltip>
            )}
          />
        </Box>

        <Box sx={{ width: { xs: '100%', md: 420 }, flexShrink: 0 }}>
          <Paper variant='outlined' sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant='h6' fontWeight={700} mb={1}>
              {t('pos:cart.title')}
            </Typography>

            {cart.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <ShoppingCartIcon
                  sx={{ fontSize: 48, color: 'text.disabled' }}
                />
                <Typography variant='subtitle1' fontWeight={600} mt={1}>
                  {t('pos:cart.empty_title')}
                </Typography>
                <Typography
                  variant='body2'
                  color='text.secondary'
                  sx={{ display: { xs: 'none', md: 'block' } }}
                >
                  {t('pos:cart.empty_help')}
                </Typography>
                <Typography
                  variant='body2'
                  color='text.secondary'
                  sx={{ display: { xs: 'block', md: 'none' } }}
                >
                  {t('pos:cart.empty_help_mobile')}
                </Typography>
              </Box>
            ) : (
              <Stack spacing={2} mb={2}>
                {cart.map((c) => {
                  const modified = Math.abs(c.price - c.default_price) > 0.001
                  const belowCost = c.price < c.avg_cost
                  return (
                    <Box key={c.product_id}>
                      <Stack
                        direction='row'
                        spacing={1}
                        alignItems='flex-start'
                      >
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
                            <Typography variant='body2' fontWeight={700} noWrap>
                              {c.name}
                            </Typography>
                            <Chip
                              label={c.type}
                              size='small'
                              variant='outlined'
                              sx={{ height: 18, fontSize: 10 }}
                            />
                            {modified && (
                              <Chip
                                label={t('pos:cart.modified_price_badge')}
                                size='small'
                                color='info'
                                sx={{ height: 18, fontSize: 10 }}
                              />
                            )}
                          </Stack>
                          <Typography variant='caption' color='text.secondary'>
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
                          onAtMaxAttempt={() =>
                            notify.warning(
                              t('pos:picker.stock_capped', { count: c.stock })
                            )
                          }
                          ariaLabel={t('pos:cart.qty_label')}
                        />
                        <TextField
                          size='small'
                          type='number'
                          inputProps={{ step: '0.01', min: 0 }}
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
                          <Typography variant='caption' color='text.secondary'>
                            {t('pos:cart.line_total')}
                          </Typography>
                          <Typography variant='body2' fontWeight={700}>
                            {formatPKR(c.price * c.qty, locale)}
                          </Typography>
                        </Box>
                      </Stack>
                      {modified && (
                        <Typography
                          variant='caption'
                          color='text.secondary'
                          mt={0.5}
                        >
                          {t('pos:cart.was_price', {
                            price: formatPKR(c.default_price, locale)
                          })}
                        </Typography>
                      )}
                      {belowCost && (
                        <Alert severity='warning' sx={{ mt: 0.5, py: 0.25 }}>
                          {t('pos:cart.below_avg_cost_warning')}
                        </Alert>
                      )}
                    </Box>
                  )
                })}
              </Stack>
            )}

            {/* Subtotal first, service charge second, then total — per spec §1.7 */}
            <Stack
              direction='row'
              justifyContent='space-between'
              alignItems='center'
              mb={1}
            >
              <Typography variant='body2' color='text.secondary'>
                {t('pos:cart.subtotal_products')}
              </Typography>
              <Typography variant='body2'>
                {formatPKR(subtotal, locale)}
              </Typography>
            </Stack>

            <TextField
              label={t('pos:cart.service_charge')}
              fullWidth
              size='small'
              type='number'
              inputProps={{ min: 0, step: '0.01' }}
              value={serviceCharge}
              onChange={(e) => setServiceCharge(e.target.value)}
              sx={{ mb: 1 }}
            />

            <Divider sx={{ my: 1 }} />

            <Stack
              direction='row'
              justifyContent='space-between'
              alignItems='center'
              mb={1.5}
            >
              <Typography variant='subtitle1' fontWeight={700}>
                {t('pos:cart.total')}
              </Typography>
              <Typography variant='h6' fontWeight={700}>
                {formatPKR(total, locale)}
              </Typography>
            </Stack>

            <Divider sx={{ my: 1.5 }} />

            <Typography variant='subtitle2' mb={1}>
              {t('pos:payment.title')}
            </Typography>

            <TextField
              label={t('pos:payment.amount_paid')}
              fullWidth
              size='small'
              type='number'
              inputProps={{ min: 0, max: total, step: '0.01' }}
              value={amountPaidStr}
              onChange={(e) => setAmountPaidStr(e.target.value)}
              sx={{ mb: 1 }}
            />
            <Stack direction='row' spacing={1} mb={1.5}>
              <Button
                size='small'
                variant='outlined'
                onClick={() => setAmountPaidStr(total.toFixed(2))}
              >
                {t('pos:payment.pay_full')}
              </Button>
              <Button
                size='small'
                variant='outlined'
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
              <Typography variant='body2' color='text.secondary'>
                {t('pos:payment.on_credit')}
              </Typography>
              <Typography
                variant='body2'
                fontWeight={700}
                color={onCredit > 0 ? 'warning.main' : 'text.disabled'}
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

            <TextField
              label={t('pos:payment.notes_placeholder')}
              fullWidth
              size='small'
              multiline
              minRows={2}
              inputProps={{ maxLength: 1000 }}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              sx={{ mb: 1.5 }}
            />

            {error && (
              <Alert severity='error' sx={{ mb: 1.5 }}>
                {error}
              </Alert>
            )}

            <Button
              variant='contained'
              fullWidth
              size='large'
              disabled={!isSubmittable}
              onClick={submit}
            >
              {submitLabel}
            </Button>
          </Paper>
        </Box>
      </Stack>

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
    </Box>
  )
}
