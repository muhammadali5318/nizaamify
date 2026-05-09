import {
  Box,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { formatPKR } from 'src/features/subscription/env'
import { useOutstanding } from 'src/features/khata/hooks'
import {
  useDailySalesLast7,
  useExpenseBreakdownThisMonth,
  useMonthlySummaryLast6
} from './hooks'

export default function ReportsPage() {
  const { t, i18n } = useTranslation(['reports', 'common', 'expenses'])
  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'

  const daily = useDailySalesLast7()
  const monthly = useMonthlySummaryLast6()
  const breakdown = useExpenseBreakdownThisMonth()
  const outstanding = useOutstanding({ onlyOutstanding: true })

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant='h5' fontWeight={700} mb={2}>
        {t('reports:title')}
      </Typography>

      <Stack spacing={2}>
        <Section title={t('reports:sections.daily_sales')}>
          {daily.isLoading ? (
            <Loading />
          ) : !daily.data || daily.data.every((d) => d.total === 0) ? (
            <Empty />
          ) : (
            <TableContainer>
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('reports:fields.date')}</TableCell>
                    <TableCell align='right'>
                      {t('reports:fields.sales')}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {daily.data.map((d) => (
                    <TableRow key={d.date}>
                      <TableCell>
                        {new Intl.DateTimeFormat(locale, {
                          weekday: 'short',
                          day: '2-digit',
                          month: '2-digit'
                        }).format(new Date(d.date))}
                      </TableCell>
                      <TableCell align='right'>
                        {formatPKR(d.total, locale)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Section>

        <Section title={t('reports:sections.monthly_summary')}>
          {monthly.isLoading ? (
            <Loading />
          ) : !monthly.data || monthly.data.length === 0 ? (
            <Empty />
          ) : (
            <TableContainer>
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('reports:fields.month')}</TableCell>
                    <TableCell align='right'>
                      {t('reports:fields.sales')}
                    </TableCell>
                    <TableCell align='right'>
                      {t('reports:fields.gross_profit')}
                    </TableCell>
                    <TableCell align='right'>
                      {t('reports:fields.expenses')}
                    </TableCell>
                    <TableCell align='right'>
                      {t('reports:fields.net_profit')}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {monthly.data.map((m) => {
                    const sales = Number(m.total_sales ?? 0)
                    const gross = Number(m.gross_profit ?? 0)
                    const exp = Number(m.total_expenses ?? 0)
                    const net = gross - exp
                    return (
                      <TableRow key={m.month ?? ''}>
                        <TableCell>
                          {m.month
                            ? new Intl.DateTimeFormat(locale, {
                                month: 'short',
                                year: 'numeric'
                              }).format(new Date(m.month))
                            : '—'}
                        </TableCell>
                        <TableCell align='right'>
                          {formatPKR(sales, locale)}
                        </TableCell>
                        <TableCell align='right'>
                          {formatPKR(gross, locale)}
                        </TableCell>
                        <TableCell align='right'>
                          {formatPKR(exp, locale)}
                        </TableCell>
                        <TableCell
                          align='right'
                          sx={{
                            color: net >= 0 ? 'success.main' : 'error.main',
                            fontWeight: 700
                          }}
                        >
                          {formatPKR(net, locale)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Section>

        <Section title={t('reports:sections.expense_breakdown')}>
          {breakdown.isLoading ? (
            <Loading />
          ) : !breakdown.data || breakdown.data.length === 0 ? (
            <Empty />
          ) : (
            <TableContainer>
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('reports:fields.category')}</TableCell>
                    <TableCell align='right'>
                      {t('reports:fields.amount')}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {breakdown.data.map((b) => (
                    <TableRow key={b.category}>
                      <TableCell>
                        {t(`expenses:categories.${b.category}`, {
                          defaultValue: b.category
                        })}
                      </TableCell>
                      <TableCell align='right'>
                        {formatPKR(b.amount, locale)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Section>

        <Section title={t('reports:sections.outstanding')}>
          {outstanding.isLoading ? (
            <Loading />
          ) : !outstanding.data || outstanding.data.length === 0 ? (
            <Empty />
          ) : (
            <TableContainer>
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>Customer</TableCell>
                    <TableCell align='right'>Outstanding</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {outstanding.data.map((c) => (
                    <TableRow key={c.customer_id ?? ''}>
                      <TableCell>
                        {c.name} — {c.phone}
                      </TableCell>
                      <TableCell align='right'>
                        {formatPKR(c.outstanding ?? 0, locale)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Section>
      </Stack>
    </Box>
  )
}

function Section({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <Paper variant='outlined' sx={{ borderRadius: 2 }}>
      <Box sx={{ p: 2 }}>
        <Typography variant='subtitle1' fontWeight={700}>
          {title}
        </Typography>
      </Box>
      {children}
    </Paper>
  )
}

function Loading() {
  return (
    <Box sx={{ p: 4, textAlign: 'center' }}>
      <CircularProgress size={24} />
    </Box>
  )
}

function Empty() {
  const { t } = useTranslation('reports')
  return (
    <Box sx={{ p: 4, textAlign: 'center' }}>
      <Typography variant='body2' color='text.secondary'>
        {t('no_data')}
      </Typography>
    </Box>
  )
}
