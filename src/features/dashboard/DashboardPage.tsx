import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  LinearProgress,
  Paper,
  Stack,
  Typography
} from '@mui/material'
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
    <Card variant='outlined' sx={{ flex: 1, minWidth: 180 }}>
      <CardContent>
        <Typography variant='caption' color='text.secondary'>
          {label}
        </Typography>
        {loading ? (
          <CircularProgress size={20} sx={{ mt: 1 }} />
        ) : (
          <Typography variant='h6' fontWeight={700} sx={{ mt: 0.5 }}>
            {value}
          </Typography>
        )}
        {helper && (
          <Typography variant='caption' color='text.secondary'>
            {helper}
          </Typography>
        )}
      </CardContent>
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
        <Typography variant='body2' fontWeight={700}>
          {pct}%
        </Typography>
      </Stack>
      <LinearProgress
        variant='determinate'
        value={pct}
        sx={{ height: 8, borderRadius: 1 }}
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
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant='h5' fontWeight={700} mb={2}>
        {t('dashboard:title')}
      </Typography>

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
        <Paper
          variant='outlined'
          sx={{ p: 3, borderRadius: 3, flex: 1, minWidth: 280 }}
        >
          <Typography variant='subtitle1' fontWeight={700} mb={2}>
            {t('dashboard:target_progress')}
          </Typography>
          {target.isLoading ? (
            <CircularProgress size={20} />
          ) : !target.data ? (
            <Stack spacing={1}>
              <Typography variant='body2' color='text.secondary'>
                {t('dashboard:no_target')}
              </Typography>
              <Button
                component={RouterLink}
                to={paths.targets}
                variant='outlined'
                size='small'
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
        </Paper>

        <Paper
          variant='outlined'
          sx={{ p: 3, borderRadius: 3, flex: 1, minWidth: 280 }}
        >
          <Typography variant='subtitle1' fontWeight={700} mb={2}>
            {t('dashboard:quick_actions.title')}
          </Typography>
          <Stack direction='row' spacing={1.5} flexWrap='wrap' useFlexGap>
            <Button
              component={RouterLink}
              to={paths.pos}
              variant='contained'
              startIcon={<PointOfSaleIcon />}
            >
              {t('dashboard:quick_actions.new_sale')}
            </Button>
            <Button
              component={RouterLink}
              to={paths.newPurchase}
              variant='outlined'
              startIcon={<LocalShippingIcon />}
            >
              {t('dashboard:quick_actions.new_purchase')}
            </Button>
            <Button
              component={RouterLink}
              to={paths.expenses}
              variant='outlined'
              startIcon={<ReceiptLongIcon />}
            >
              {t('dashboard:quick_actions.add_expense')}
            </Button>
            <Button
              component={RouterLink}
              to={paths.khata}
              variant='outlined'
              startIcon={<AccountBalanceWalletIcon />}
            >
              {t('dashboard:quick_actions.view_khata')}
            </Button>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  )
}
