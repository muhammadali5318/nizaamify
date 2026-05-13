import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { paths } from 'src/paths'
import { useSale } from './hooks'
import { formatPKR } from 'src/features/subscription/env'
import { usePermission } from 'src/lib/permissions'
import {
  Badge,
  type BadgeVariant,
  Banner,
  Button,
  Card,
  DataTable,
  FullPageSpinner,
  type DataTableColumn
} from 'src/components/ui'

type SaleItem = {
  id: string
  qty: number
  price_at_sale: number | string
  /** v2.10a: NULL when caller lacks view_sale_cost (column rendered only
   *  when canViewSaleCost === true, so the runtime value is non-null
   *  inside the gated column cells). */
  cost_at_sale: number | string | null
  /** v2.2 line discount snapshot. */
  line_discount_type?: 'percent' | 'fixed' | null
  line_discount_value?: number | null
  line_discount_amount?: number | null
  /** v2.6b/c: server-computed values from sale_item_financials. */
  allocated_sale_discount: number | string
  line_value: number | string
  line_revenue: number | string
  /** v2.10a: NULL when caller lacks view_sale_cost. */
  line_cost: number | string | null
  /** v2.10a: NULL when caller lacks view_sale_cost. */
  line_profit: number | string | null
  product?: { name?: string } | null
}

type LedgerRow = {
  id: string
  type: 'debit' | 'credit'
  amount: number | string
  created_at: string
}

const paymentBadgeVariant: Record<string, BadgeVariant> = {
  cash: 'success',
  credit: 'warning',
  partial: 'info'
}

export default function SaleDetailPage() {
  const { t, i18n } = useTranslation(['sales', 'khata', 'common'])
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'
  const { data: sale, isLoading, error } = useSale(id)
  // v2.9.1 hot-patch — cost/profit columns gated on view_sale_cost.
  // Migration 0091's permissive row-read policy admits salesperson row
  // visibility but the cost columns are still on the row; HIDE them at
  // the render layer per B.2 (CRUD = HIDE for cost-sensitive columns).
  // view_profit_margin gates margin % displays — none exist on this page
  // today (only line absolute-profit, which is view_sale_cost-gated).
  //
  // HOOKS ORDER: must be called BEFORE any early return below. React's
  // rule-of-hooks panics on conditional ordering ("Rendered more hooks
  // than during the previous render") if a useQuery hook fires on some
  // renders but not others.
  const canViewSaleCost = usePermission('view_sale_cost')

  if (isLoading) return <FullPageSpinner />

  if (error || !sale) {
    return (
      <Box sx={{ maxWidth: 1024, mx: 'auto', width: '100%' }}>
        <Banner variant='error'>{t('sales:detail.not_found')}</Banner>
        <Button
          variant='secondary'
          onClick={() => navigate(paths.sales)}
          sx={{ mt: 2 }}
        >
          {t('sales:detail.back')}
        </Button>
      </Box>
    )
  }

  const shortId = sale.id.slice(0, 8)
  // v2.6c: every money value is read from the server (invoice_financials +
  // sale_item_financials). No JS arithmetic on money. The invariant
  // `outstanding = total - amount_paid` lives in invoice_financials.
  const itemsSubtotal = sale.financials?.items_subtotal ?? 0
  const saleDiscount = Number(sale.sale_discount_amount ?? 0)
  const serviceCharge = Number(sale.service_charge ?? 0)
  const total = Number(sale.total)
  const amountPaid = Number(sale.amount_paid ?? 0)
  const onCredit = sale.financials?.outstanding ?? 0

  // Discount line label (v2.3: tiers no longer drive discount; the only
  // source is the manual sale_discount popup snapshot on the invoice).
  const saleDiscountLabel: string | null = (() => {
    if (sale.sale_discount_type === 'percent') {
      return t('sales:totals.sale_discount_percent', {
        percent: Number(sale.sale_discount_value ?? 0)
      })
    }
    if (sale.sale_discount_type === 'fixed') {
      return t('sales:totals.sale_discount_fixed')
    }
    return null
  })()

  const linkedLedger = sale.ledger
  const isCreditish =
    sale.payment_type === 'credit' || sale.payment_type === 'partial'

  const paymentLabel =
    sale.payment_type === 'cash'
      ? t('sales:filters.cash')
      : sale.payment_type === 'credit'
        ? t('sales:filters.credit')
        : t('sales:filters.partial')

  const itemColumns: DataTableColumn<SaleItem>[] = [
    {
      id: 'product',
      header: t('sales:detail.product'),
      cardRole: 'heading',
      cell: (it) => (
        <Stack spacing={0.25}>
          <Stack direction='row' spacing={0.75} alignItems='center'>
            <span>{it.product?.name ?? t('sales:detail.deleted_product')}</span>
            {/* v2.8.4: snapshot of whether this line drew from an expired
             *  batch. Persists even if the batch is later written off. */}
            {it.sold_expired && (
              <Badge
                variant='error'
                label={t('sales:detail.sold_expired_badge')}
              />
            )}
          </Stack>
          {/* v2.8: batch_no surfaced when the line drew from a batch. */}
          {it.batch?.batch_no && (
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                color: 'var(--text-muted)'
              }}
            >
              {it.batch.batch_no}
            </span>
          )}
        </Stack>
      )
    },
    {
      id: 'qty',
      header: t('sales:detail.qty'),
      align: 'end',
      cell: (it) => it.qty
    },
    {
      id: 'unit_price',
      header: t('sales:detail.unit_price'),
      align: 'end',
      cell: (it) => formatPKR(Number(it.price_at_sale), locale)
    },
    ...(canViewSaleCost
      ? [
          {
            id: 'unit_cost',
            header: t('sales:detail.unit_cost'),
            align: 'end' as const,
            hideOnMobile: true,
            cell: (it: SaleItem) =>
              formatPKR(Number(it.cost_at_sale ?? 0), locale)
          }
        ]
      : []),
    {
      id: 'discount',
      header: t('sales:items.columns.discount'),
      align: 'end',
      hideOnMobile: true,
      cell: (it) => {
        if (!it.line_discount_type || !it.line_discount_amount) {
          return (
            <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
              {t('sales:items.no_discount')}
            </Typography>
          )
        }
        if (it.line_discount_type === 'percent') {
          return t('sales:items.discount_percent_display', {
            percent: Number(it.line_discount_value ?? 0),
            amount: formatPKR(Number(it.line_discount_amount), locale)
          })
        }
        return t('sales:items.discount_fixed_display', {
          amount: formatPKR(Number(it.line_discount_amount), locale)
        })
      }
    },
    {
      id: 'line_total',
      header: t('sales:detail.line_total'),
      align: 'end',
      // v2.6c: line_value = price*qty − line_discount, server-computed.
      cell: (it) => formatPKR(Number(it.line_value), locale)
    },
    ...(canViewSaleCost
      ? [
          {
            id: 'line_profit',
            header: t('sales:detail.line_profit'),
            align: 'end' as const,
            hideOnMobile: true,
            cell: (it: SaleItem) => {
              // v2.6b: single source of truth is sale_item_financials.line_profit.
              // No display-side arithmetic — read the server's computed value.
              const profit = Number(it.line_profit ?? 0)
              return (
                <Box
                  component='span'
                  sx={{
                    color:
                      profit < 0
                        ? 'var(--status-error-text)'
                        : 'var(--status-success-text)',
                    fontWeight: 500
                  }}
                >
                  {formatPKR(profit, locale)}
                </Box>
              )
            }
          }
        ]
      : [])
  ]

  const ledgerColumns: DataTableColumn<LedgerRow>[] = [
    {
      id: 'date',
      header: t('khata:history.date'),
      cardRole: 'heading',
      cell: (l) =>
        new Intl.DateTimeFormat(locale, {
          dateStyle: 'short',
          timeStyle: 'short'
        }).format(new Date(l.created_at))
    },
    {
      id: 'type',
      header: t('khata:history.type'),
      cell: (l) =>
        l.type === 'debit' ? (
          <Badge variant='warning' label={t('khata:history.debit')} />
        ) : (
          <Badge variant='success' label={t('khata:history.credit')} />
        )
    },
    {
      id: 'amount',
      header: t('khata:history.amount'),
      align: 'end',
      cell: (l) => formatPKR(Number(l.amount), locale)
    }
  ]

  return (
    <Box sx={{ maxWidth: 1024, mx: 'auto', width: '100%' }}>
      <Button
        variant='ghost'
        onClick={() => navigate(paths.sales)}
        sx={{ mb: 1 }}
      >
        {t('sales:detail.back')}
      </Button>

      <Card sx={{ mb: 2 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent='space-between'
          alignItems={{ sm: 'center' }}
          spacing={2}
        >
          <Box>
            <Typography variant='display' component='h1'>
              {t('sales:detail.title', { shortId })}
            </Typography>
            <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
              {new Intl.DateTimeFormat(locale, {
                dateStyle: 'medium',
                timeStyle: 'short'
              }).format(new Date(sale.created_at))}
            </Typography>
          </Box>
          <Badge
            variant={paymentBadgeVariant[sale.payment_type] ?? 'neutral'}
            label={paymentLabel}
          />
        </Stack>
        <Stack direction='row' spacing={3} mt={2} flexWrap='wrap' rowGap={2}>
          <Box>
            <Typography variant='overline' sx={{ color: 'var(--text-muted)' }}>
              {t('sales:columns.customer')}
            </Typography>
            <Typography variant='body1'>
              {sale.customer ? (
                <Button
                  variant='link'
                  onClick={() =>
                    navigate(paths.gotoCustomer(sale.customer!.id))
                  }
                >
                  {sale.customer.name}
                </Button>
              ) : (
                t('sales:walk_in')
              )}
            </Typography>
          </Box>
          <Box>
            <Typography variant='overline' sx={{ color: 'var(--text-muted)' }}>
              {t('sales:detail.cashier')}
            </Typography>
            <Typography variant='body1'>
              {sale.cashier?.email ?? '—'}
            </Typography>
          </Box>
        </Stack>

        {sale.notes && (
          <Box sx={{ mt: 2 }}>
            <Typography variant='overline' sx={{ color: 'var(--text-muted)' }}>
              {t('sales:detail.notes_label')}
            </Typography>
            <Typography
              variant='body2'
              sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}
            >
              {sale.notes}
            </Typography>
          </Box>
        )}
      </Card>

      <Card sx={{ mb: 2 }} noPadding>
        <Box sx={{ p: 2, borderBottom: '1px solid var(--border-subtle)' }}>
          <Typography variant='h3'>{t('sales:detail.items')}</Typography>
        </Box>
        {sale.items.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
              {t('sales:detail.service_only')}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ p: 2 }}>
            <DataTable
              columns={itemColumns}
              rows={sale.items as SaleItem[]}
              getRowId={(it) => it.id}
              ariaLabel={t('sales:detail.items')}
            />
          </Box>
        )}
        <Stack
          direction='row'
          justifyContent='flex-end'
          spacing={4}
          sx={{ p: 2, borderTop: '1px solid var(--border-subtle)' }}
        >
          <Box sx={{ minWidth: 240 }}>
            <Stack direction='row' justifyContent='space-between'>
              <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
                {t('sales:detail.subtotal')}
              </Typography>
              <Typography variant='body2'>
                {formatPKR(itemsSubtotal, locale)}
              </Typography>
            </Stack>
            {saleDiscount > 0 && saleDiscountLabel && (
              <Stack direction='row' justifyContent='space-between' mt={0.5}>
                <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
                  {saleDiscountLabel}
                </Typography>
                <Typography variant='body2'>
                  −{formatPKR(saleDiscount, locale)}
                </Typography>
              </Stack>
            )}
            {serviceCharge > 0 && (
              <Stack direction='row' justifyContent='space-between' mt={0.5}>
                <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
                  {t('sales:columns.service_charge')}
                </Typography>
                <Typography variant='body2'>
                  {formatPKR(serviceCharge, locale)}
                </Typography>
              </Stack>
            )}
            <Stack
              direction='row'
              justifyContent='space-between'
              mt={1}
              pt={1}
              sx={{ borderTop: '1px solid var(--border-default)' }}
            >
              <Typography variant='h3' component='span'>
                {t('sales:columns.total')}
              </Typography>
              <Typography variant='h2' component='span'>
                {formatPKR(total, locale)}
              </Typography>
            </Stack>
            <Stack direction='row' justifyContent='space-between' mt={1}>
              <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
                {t('sales:detail.amount_paid_cash')}
              </Typography>
              <Typography variant='body2'>
                {formatPKR(amountPaid, locale)}
              </Typography>
            </Stack>
            {onCredit > 0 && (
              <Stack direction='row' justifyContent='space-between' mt={0.5}>
                <Typography
                  variant='body2'
                  sx={{ color: 'var(--status-warning-text)' }}
                >
                  {t('sales:detail.on_credit')}
                </Typography>
                <Stack direction='row' spacing={1} alignItems='center'>
                  <Typography
                    variant='body2'
                    sx={{
                      fontWeight: 600,
                      color: 'var(--status-warning-text)'
                    }}
                  >
                    {formatPKR(onCredit, locale)}
                  </Typography>
                  {sale.customer && (
                    <Button
                      variant='link'
                      onClick={() =>
                        navigate(paths.gotoCustomer(sale.customer!.id))
                      }
                    >
                      {t('sales:detail.view_khata')}
                    </Button>
                  )}
                </Stack>
              </Stack>
            )}
          </Box>
        </Stack>
      </Card>

      {isCreditish && sale.customer && (
        <Card noPadding>
          <Stack
            direction='row'
            justifyContent='space-between'
            alignItems='center'
            sx={{ p: 2, borderBottom: '1px solid var(--border-subtle)' }}
          >
            <Typography variant='h3'>
              {t('sales:detail.khata_panel_title')}
            </Typography>
            <Button
              variant='link'
              onClick={() => navigate(paths.gotoCustomer(sale.customer!.id))}
            >
              {t('sales:detail.view_customer_khata')}
            </Button>
          </Stack>
          <Box sx={{ p: 2 }}>
            <DataTable
              columns={ledgerColumns}
              rows={linkedLedger as LedgerRow[]}
              getRowId={(l) => l.id}
              empty={
                <Box sx={{ py: 2 }}>
                  <Typography
                    variant='body2'
                    sx={{ color: 'var(--text-muted)', textAlign: 'center' }}
                  >
                    {t('sales:detail.no_khata_entries')}
                  </Typography>
                </Box>
              }
              ariaLabel={t('sales:detail.khata_panel_title')}
            />
          </Box>
        </Card>
      )}
    </Box>
  )
}
