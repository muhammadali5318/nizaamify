import Box from '@mui/material/Box'
import LinearProgress from '@mui/material/LinearProgress'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import PointOfSaleIcon from '@mui/icons-material/PointOfSale'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router'
import { paths } from 'src/paths'
import { useMonthlySummary, useTodaySales, useTotalOutstanding } from './hooks'
import { useTargetForMonth, currentMonthISO } from 'src/features/targets/hooks'
import { formatPKR } from 'src/features/subscription/env'
import { Button, Card, Spinner } from 'src/components/ui'
import { PageHeader } from 'src/components/layout'
import { PermissionGated } from 'src/components/ui/PermissionGated'
import { usePermission } from 'src/lib/permissions'
import InventoryAlertsWidget from 'src/features/batches/InventoryAlertsWidget'
import ExpiredStockWidget from 'src/features/batches/ExpiredStockWidget'
import ExpiredSalesWidget from 'src/features/sales/ExpiredSalesWidget'

function StatCard({
  label,
  value,
  helper,
  loading
}: {
  label: string
  value: string
  helper?: string
  loading?: boolean
}) {
  return (
    <Card sx={{ flex: 1, minWidth: 180 }}>
      <Typography variant='overline' sx={{ color: 'var(--text-muted)' }}>
        {label}
      </Typography>
      {loading ? (
        <Box sx={{ mt: 1 }}>
          <Spinner size='inline' />
        </Box>
      ) : (
        <Typography variant='h2' component='div' sx={{ mt: 0.5 }}>
          {value}
        </Typography>
      )}
      {helper && (
        <Typography
          variant='caption'
          sx={{ color: 'var(--text-muted)', display: 'block', mt: 0.5 }}
        >
          {helper}
        </Typography>
      )}
    </Card>
  )
}

function TargetBar({
  label,
  achieved,
  target
}: {
  label: string
  achieved: number
  target: number
}) {
  const pct =
    target > 0 ? Math.min(100, Math.round((achieved / target) * 100)) : 0
  return (
    <Box>
      <Stack direction='row' justifyContent='space-between' mb={0.5}>
        <Typography variant='body2'>{label}</Typography>
        <Typography variant='body2' sx={{ fontWeight: 600 }}>
          {pct}%
        </Typography>
      </Stack>
      <LinearProgress
        variant='determinate'
        value={pct}
        sx={{
          height: 8,
          borderRadius: 'var(--radius-sm)',
          backgroundColor: 'var(--surface-muted)',
          '& .MuiLinearProgress-bar': {
            borderRadius: 'var(--radius-sm)'
          }
        }}
      />
    </Box>
  )
}

export default function DashboardPage() {
  const { t, i18n } = useTranslation(['dashboard', 'common'])
  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'
  // v2.9.1 hot-patch — permission gates for cost / profit / financial tiles.
  // HOOKS ORDER: top of the component body, BEFORE any early returns. Mirrors
  // the SaleDetailPage pattern that hit React's "hooks order" rule.
  const canViewCustomerOutstanding = usePermission('view_customer_outstanding')
  const canViewSaleCost = usePermission('view_sale_cost')
  const canViewMonthlyTargets = usePermission('view_monthly_targets')
  const today = useTodaySales()
  const month = currentMonthISO()
  const summary = useMonthlySummary(month)
  const outstanding = useTotalOutstanding()
  const target = useTargetForMonth(month)

  const totalSales = Number(summary.data?.total_sales ?? 0)
  const grossProfit = Number(summary.data?.gross_profit ?? 0)
  const totalExpenses = Number(summary.data?.total_expenses ?? 0)
  const netProfit = grossProfit - totalExpenses

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto', width: '100%' }}>
      <PageHeader title={t('dashboard:title')} />

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        flexWrap='wrap'
        useFlexGap
        mb={3}
      >
        {/* v2.9.1: today_sales + mtd_sales are revenue rollups (no cost data),
         *  visible to anyone who reaches the dashboard. */}
        <StatCard
          label={t('dashboard:today_sales')}
          value={formatPKR(today.data?.total_sales ?? 0, locale)}
          helper={`${today.data?.sales_count ?? 0} ${t('dashboard:today').toLowerCase()}`}
          loading={today.isLoading}
        />
        {/* v2.9.1: outstanding aggregate gated on view_customer_outstanding.
         *  No has_khata boolean fallback for aggregates — HIDE the tile. */}
        {canViewCustomerOutstanding && (
          <StatCard
            label={t('dashboard:outstanding_total')}
            value={formatPKR(outstanding.data ?? 0, locale)}
            loading={outstanding.isLoading}
          />
        )}
        <StatCard
          label={t('dashboard:mtd_sales')}
          value={formatPKR(totalSales, locale)}
          loading={summary.isLoading}
        />
        {/* v2.9.1: net+gross profit gated on view_sale_cost. HIDE entirely
         *  when missing — no boolean substitute for profit aggregates. */}
        {canViewSaleCost && (
          <StatCard
            label={t('dashboard:mtd_net_profit')}
            value={formatPKR(netProfit, locale)}
            helper={`${t('dashboard:mtd_gross_profit')}: ${formatPKR(grossProfit, locale)}`}
            loading={summary.isLoading}
          />
        )}
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        {/* v2.9.1: target progress block gated on view_monthly_targets. HIDE
         *  the whole card if missing — every value in it (target_sale,
         *  target_gross_profit, target_net_profit, current MTD sales) is
         *  catalog-gated. Cost-derived bars also gated on view_sale_cost. */}
        {canViewMonthlyTargets && (
          <Card sx={{ flex: 1, minWidth: 280 }}>
            <Typography variant='h3' sx={{ mb: 2 }}>
              {t('dashboard:target_progress')}
            </Typography>
            {target.isLoading ? (
              <Spinner size='inline' />
            ) : !target.data ? (
              <Stack spacing={1.5}>
                <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
                  {t('dashboard:no_target')}
                </Typography>
                <PermissionGated permission='manage_monthly_targets'>
                  <Button
                    component={RouterLink}
                    to={paths.targets}
                    variant='secondary'
                    size='sm'
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    {t('dashboard:set_target')}
                  </Button>
                </PermissionGated>
              </Stack>
            ) : (
              <Stack spacing={2}>
                <TargetBar
                  label={`${t('dashboard:mtd_sales')} — ${formatPKR(target.data.target_sale, locale)}`}
                  achieved={totalSales}
                  target={Number(target.data.target_sale)}
                />
                {canViewSaleCost && (
                  <TargetBar
                    label={`${t('dashboard:mtd_gross_profit')} — ${formatPKR(target.data.target_gross_profit, locale)}`}
                    achieved={grossProfit}
                    target={Number(target.data.target_gross_profit)}
                  />
                )}
                {canViewSaleCost && (
                  <TargetBar
                    label={`${t('dashboard:mtd_net_profit')} — ${formatPKR(target.data.target_net_profit, locale)}`}
                    achieved={netProfit}
                    target={Number(target.data.target_net_profit)}
                  />
                )}
              </Stack>
            )}
          </Card>
        )}

        {/* v2.9.1: quick actions become permission-aware — grey-out (B.2 CRUD
         *  rule) for the management actions a salesperson lacks. */}
        <Card sx={{ flex: 1, minWidth: 280 }}>
          <Typography variant='h3' sx={{ mb: 2 }}>
            {t('dashboard:quick_actions.title')}
          </Typography>
          <Stack direction='row' spacing={1.5} flexWrap='wrap' useFlexGap>
            <PermissionGated permission='record_sale'>
              <Button
                component={RouterLink}
                to={paths.pos}
                variant='primary'
                startIcon={<PointOfSaleIcon />}
              >
                {t('dashboard:quick_actions.new_sale')}
              </Button>
            </PermissionGated>
            <PermissionGated permission='record_purchase'>
              <Button
                component={RouterLink}
                to={paths.newPurchase}
                variant='secondary'
                startIcon={<LocalShippingIcon />}
              >
                {t('dashboard:quick_actions.new_purchase')}
              </Button>
            </PermissionGated>
            <PermissionGated permission='create_expense'>
              <Button
                component={RouterLink}
                to={paths.expenses}
                variant='secondary'
                startIcon={<ReceiptLongIcon />}
              >
                {t('dashboard:quick_actions.add_expense')}
              </Button>
            </PermissionGated>
            <PermissionGated permission='view_customer_khata'>
              <Button
                component={RouterLink}
                to={paths.khata}
                variant='secondary'
                startIcon={<AccountBalanceWalletIcon />}
              >
                {t('dashboard:quick_actions.view_khata')}
              </Button>
            </PermissionGated>
          </Stack>
        </Card>

        {/* v2.8 inventory alerts — auto-hides for shops without batched
         *  products, so it's safe to mount unconditionally. */}
        <InventoryAlertsWidget />

        {/* v2.8.3 expired stock — auto-hides when no expired-with-stock
         *  batches exist. Sits below the v2.8 alerts to keep severity
         *  ordering "preventive (amber) → corrective (red)". */}
        <ExpiredStockWidget />

        {/* v2.8.4 expired-stock sales — historical audit, opt-out by zero
         *  occurrences. Auto-hides when the count is zero. */}
        <ExpiredSalesWidget />
      </Stack>
    </Box>
  )
}
