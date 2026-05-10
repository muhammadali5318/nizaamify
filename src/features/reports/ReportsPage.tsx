import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { formatPKR } from 'src/features/subscription/env'
import { useOutstanding } from 'src/features/khata/hooks'
import {
  useDailySalesLast7,
  useExpenseBreakdownThisMonth,
  useMonthlySummaryLast6
} from './hooks'
import {
  Card,
  DataTable,
  EmptyState,
  type DataTableColumn
} from 'src/components/ui'
import { PageHeader } from 'src/components/layout'

type DailyRow = { date: string; total: number }
type MonthlyRow = {
  month?: string | null
  total_sales?: number | string | null
  gross_profit?: number | string | null
  total_expenses?: number | string | null
}
type BreakdownRow = { category: string; amount: number | string }
type OutstandingRow = {
  customer_id?: string | null
  name: string
  phone: string
  outstanding?: number | string | null
}

export default function ReportsPage() {
  const { t, i18n } = useTranslation(['reports', 'common', 'expenses'])
  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'

  const daily = useDailySalesLast7()
  const monthly = useMonthlySummaryLast6()
  const breakdown = useExpenseBreakdownThisMonth()
  const outstanding = useOutstanding({ onlyOutstanding: true })

  const dailyRows = (daily.data ?? []) as DailyRow[]
  const dailyHasData = dailyRows.some((d) => d.total !== 0)
  const dailyColumns: DataTableColumn<DailyRow>[] = [
    {
      id: 'date',
      header: t('reports:fields.date'),
      cardRole: 'heading',
      cell: (d) =>
        new Intl.DateTimeFormat(locale, {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit'
        }).format(new Date(d.date))
    },
    {
      id: 'sales',
      header: t('reports:fields.sales'),
      align: 'end',
      cell: (d) => formatPKR(d.total, locale)
    }
  ]

  const monthlyRows = (monthly.data ?? []) as MonthlyRow[]
  const monthlyColumns: DataTableColumn<MonthlyRow>[] = [
    {
      id: 'month',
      header: t('reports:fields.month'),
      cardRole: 'heading',
      cell: (m) =>
        m.month
          ? new Intl.DateTimeFormat(locale, {
              month: 'short',
              year: 'numeric'
            }).format(new Date(m.month))
          : '—'
    },
    {
      id: 'sales',
      header: t('reports:fields.sales'),
      align: 'end',
      cell: (m) => formatPKR(Number(m.total_sales ?? 0), locale)
    },
    {
      id: 'gross_profit',
      header: t('reports:fields.gross_profit'),
      align: 'end',
      hideOnMobile: true,
      cell: (m) => formatPKR(Number(m.gross_profit ?? 0), locale)
    },
    {
      id: 'expenses',
      header: t('reports:fields.expenses'),
      align: 'end',
      hideOnMobile: true,
      cell: (m) => formatPKR(Number(m.total_expenses ?? 0), locale)
    },
    {
      id: 'net_profit',
      header: t('reports:fields.net_profit'),
      align: 'end',
      cell: (m) => {
        const gross = Number(m.gross_profit ?? 0)
        const exp = Number(m.total_expenses ?? 0)
        const net = gross - exp
        return (
          <Box
            component='span'
            sx={{
              fontWeight: 700,
              color:
                net >= 0
                  ? 'var(--status-success-text)'
                  : 'var(--status-error-text)'
            }}
          >
            {formatPKR(net, locale)}
          </Box>
        )
      }
    }
  ]

  const breakdownRows = (breakdown.data ?? []) as BreakdownRow[]
  const breakdownColumns: DataTableColumn<BreakdownRow>[] = [
    {
      id: 'category',
      header: t('reports:fields.category'),
      cardRole: 'heading',
      cell: (b) =>
        t(`expenses:categories.${b.category}`, { defaultValue: b.category })
    },
    {
      id: 'amount',
      header: t('reports:fields.amount'),
      align: 'end',
      cell: (b) => formatPKR(Number(b.amount), locale)
    }
  ]

  const outstandingRows = (outstanding.data ?? []) as OutstandingRow[]
  const outstandingColumns: DataTableColumn<OutstandingRow>[] = [
    {
      id: 'customer',
      header: 'Customer',
      cardRole: 'heading',
      cell: (c) => `${c.name} — ${c.phone}`
    },
    {
      id: 'outstanding',
      header: 'Outstanding',
      align: 'end',
      cell: (c) => formatPKR(Number(c.outstanding ?? 0), locale)
    }
  ]

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto', width: '100%' }}>
      <PageHeader title={t('reports:title')} />

      <Stack spacing={2}>
        <Section title={t('reports:sections.daily_sales')}>
          <DataTable
            columns={dailyColumns}
            rows={dailyHasData ? dailyRows : []}
            getRowId={(d) => d.date}
            loading={daily.isLoading}
            empty={
              <Box sx={{ py: 4 }}>
                <EmptyState title={t('reports:no_data')} />
              </Box>
            }
            ariaLabel={t('reports:sections.daily_sales')}
          />
        </Section>

        <Section title={t('reports:sections.monthly_summary')}>
          <DataTable
            columns={monthlyColumns}
            rows={monthlyRows}
            getRowId={(m) => m.month ?? ''}
            loading={monthly.isLoading}
            empty={
              <Box sx={{ py: 4 }}>
                <EmptyState title={t('reports:no_data')} />
              </Box>
            }
            ariaLabel={t('reports:sections.monthly_summary')}
          />
        </Section>

        <Section title={t('reports:sections.expense_breakdown')}>
          <DataTable
            columns={breakdownColumns}
            rows={breakdownRows}
            getRowId={(b) => b.category}
            loading={breakdown.isLoading}
            empty={
              <Box sx={{ py: 4 }}>
                <EmptyState title={t('reports:no_data')} />
              </Box>
            }
            ariaLabel={t('reports:sections.expense_breakdown')}
          />
        </Section>

        <Section title={t('reports:sections.outstanding')}>
          <DataTable
            columns={outstandingColumns}
            rows={outstandingRows}
            getRowId={(c) => c.customer_id ?? c.name}
            loading={outstanding.isLoading}
            empty={
              <Box sx={{ py: 4 }}>
                <EmptyState title={t('reports:no_data')} />
              </Box>
            }
            ariaLabel={t('reports:sections.outstanding')}
          />
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
    <Card noPadding>
      <Box sx={{ p: 2, borderBottom: '1px solid var(--border-subtle)' }}>
        <Typography variant='h3'>{title}</Typography>
      </Box>
      <Box sx={{ p: 2 }}>{children}</Box>
    </Card>
  )
}
