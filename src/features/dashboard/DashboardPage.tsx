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
import InventoryAlertsWidget from 'src/features/batches/InventoryAlertsWidget'
import ExpiredStockWidget from 'src/features/batches/ExpiredStockWidget'

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
        <StatCard
          label={t('dashboard:today_sales')}
          value={formatPKR(today.data?.total_sales ?? 0, locale)}
          helper={`${today.data?.sales_count ?? 0} ${t('dashboard:today').toLowerCase()}`}
          loading={today.isLoading}
        />
        <StatCard
          label={t('dashboard:outstanding_total')}
          value={formatPKR(outstanding.data ?? 0, locale)}
          loading={outstanding.isLoading}
        />
        <StatCard
          label={t('dashboard:mtd_sales')}
          value={formatPKR(totalSales, locale)}
          loading={summary.isLoading}
        />
        <StatCard
          label={t('dashboard:mtd_net_profit')}
          value={formatPKR(netProfit, locale)}
          helper={`${t('dashboard:mtd_gross_profit')}: ${formatPKR(grossProfit, locale)}`}
          loading={summary.isLoading}
        />
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
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
              <Button
                component={RouterLink}
                to={paths.targets}
                variant='secondary'
                size='sm'
                sx={{ alignSelf: 'flex-start' }}
              >
                {t('dashboard:set_target')}
              </Button>
            </Stack>
          ) : (
            <Stack spacing={2}>
              <TargetBar
                label={`${t('dashboard:mtd_sales')} — ${formatPKR(target.data.target_sale, locale)}`}
                achieved={totalSales}
                target={Number(target.data.target_sale)}
              />
              <TargetBar
                label={`${t('dashboard:mtd_gross_profit')} — ${formatPKR(target.data.target_gross_profit, locale)}`}
                achieved={grossProfit}
                target={Number(target.data.target_gross_profit)}
              />
              <TargetBar
                label={`${t('dashboard:mtd_net_profit')} — ${formatPKR(target.data.target_net_profit, locale)}`}
                achieved={netProfit}
                target={Number(target.data.target_net_profit)}
              />
            </Stack>
          )}
        </Card>

        <Card sx={{ flex: 1, minWidth: 280 }}>
          <Typography variant='h3' sx={{ mb: 2 }}>
            {t('dashboard:quick_actions.title')}
          </Typography>
          <Stack direction='row' spacing={1.5} flexWrap='wrap' useFlexGap>
            <Button
              component={RouterLink}
              to={paths.pos}
              variant='primary'
              startIcon={<PointOfSaleIcon />}
            >
              {t('dashboard:quick_actions.new_sale')}
            </Button>
            <Button
              component={RouterLink}
              to={paths.newPurchase}
              variant='secondary'
              startIcon={<LocalShippingIcon />}
            >
              {t('dashboard:quick_actions.new_purchase')}
            </Button>
            <Button
              component={RouterLink}
              to={paths.expenses}
              variant='secondary'
              startIcon={<ReceiptLongIcon />}
            >
              {t('dashboard:quick_actions.add_expense')}
            </Button>
            <Button
              component={RouterLink}
              to={paths.khata}
              variant='secondary'
              startIcon={<AccountBalanceWalletIcon />}
            >
              {t('dashboard:quick_actions.view_khata')}
            </Button>
          </Stack>
        </Card>

        {/* v2.8 inventory alerts — auto-hides for shops without batched
         *  products, so it's safe to mount unconditionally. */}
        <InventoryAlertsWidget />

        {/* v2.8.3 expired stock — auto-hides when no expired-with-stock
         *  batches exist. Sits below the v2.8 alerts to keep severity
         *  ordering "preventive (amber) → corrective (red)". */}
        <ExpiredStockWidget />
      </Stack>
    </Box>
  )
}
