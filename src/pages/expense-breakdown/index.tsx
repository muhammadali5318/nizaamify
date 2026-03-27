import { Box, CircularProgress, Stack, Typography } from '@mui/material'
import { useRef, useState } from 'react'
import dayjs from 'dayjs'

import styles from './expenseBreakdown.module.scss'
import ExpensePageHeader from './components/expense-header/ExpensePageHeader'
import ExpensesGrandTotal from './components/expense-header'
import ReusableAccordion from './components/expense-accordion'

import { useFetchExpenseBreakdown } from './hooks/useFetchExpenseBreakdown'
import { useAuth } from 'src/context/AuthProvider'
import { RangeISO } from 'src/components/date-range-selector'
import { formatAmountWithCommas } from 'src/utils/stringUtils'
import RevenueAccordion from './components/revenue-accordion'
import NonPLItemsBreakdown from '../non-pl-items'

const ExpenseBreakdown = () => {
  const { accessToken } = useAuth()
  const [allExpanded, setAllExpanded] = useState(false)

  const lastMonth = dayjs().subtract(1, 'month')

  const [dateRange, setDateRange] = useState<RangeISO>({
    start: lastMonth.startOf('month').toISOString(),
    end: lastMonth.endOf('month').toISOString()
  })

  // Explicit date validity check (UX fix)
  const hasValidDate = Boolean(dateRange?.start) && Boolean(dateRange?.end)

  const { data, isPending } = useFetchExpenseBreakdown({
    enabled: !!accessToken && hasValidDate,
    startDate: dateRange.start,
    endDate: dateRange.end
  })

  const pageRef = useRef<HTMLDivElement>(null)

  return (
    <>
      <Box className={styles.expenseBreakdownRoot} width='100%'>
        <ExpensePageHeader
          heading='P&L Items Breakdown'
          dateRange={dateRange}
          onDateChange={setDateRange}
          avatarSrc='/assets/wallet-bg-green.svg'
          subheading='Detailed view of P&L items categories and subcategories'
          data={data}
          allExpanded={allExpanded}
          setAllExpanded={setAllExpanded}
          pdfRef={pageRef}
        />

        {/* 🔹 No date selected */}
        {!hasValidDate && (
          <Box
            minHeight='20vh'
            width={'100%'}
            display='flex'
            alignItems='center'
            justifyContent='center'
            textAlign='center'
          >
            <Typography variant='body2' color='text.secondary'>
              Select a date range to view expense breakdown.
            </Typography>
          </Box>
        )}

        {/* 🔹 Loading */}
        {hasValidDate && isPending && (
          <Box
            width='100%'
            display='flex'
            alignItems='center'
            justifyContent='center'
            minHeight='20vh'
          >
            <CircularProgress />
          </Box>
        )}

        {/* 🔹 Data */}
        {hasValidDate && !isPending && (
          <Stack spacing={2} ref={pageRef} width={'100%'}>
            <Stack
              spacing={2}
              sx={{
                borderRadius: '24px',
                border: '1px solid var(--grey-200)',
                padding: 2
              }}
            >
              <ExpensesGrandTotal
                title={'REVENUE GRAND TOTAL'}
                label='Total Monthly Revenue:'
                total={formatAmountWithCommas(data?.total_revenue) ?? 0}
              />
              <RevenueAccordion
                title={'Income/Revenue'}
                dateRange={dateRange}
                incomeAndRevenue={data?.revenue_cateogories}
                expanded={allExpanded}
                total={data?.total_revenue}
              />
            </Stack>

            <Stack
              spacing={2}
              sx={{
                borderRadius: '24px',
                border: '1px solid var(--grey-200)',
                padding: 2
              }}
            >
              <ExpensesGrandTotal
                title={'EXPENSES GRAND TOTAL'}
                label='Total Monthly Expenses:'
                total={formatAmountWithCommas(data?.total) ?? 0}
              />
              {data?.categories?.map((category: any, idx: number) => {
                const expenseType = data?.expense_type?.find(
                  (expense: any) =>
                    expense.expense_type === category?.parent_category
                )

                return (
                  <ReusableAccordion
                    key={idx}
                    title={category?.parent_category}
                    dateRange={dateRange}
                    total={category?.amount}
                    chips={[
                      `${expenseType?.expense_subtypes?.length ?? 0} subcategories`
                    ]}
                    expenseSubtypes={expenseType?.expense_subtypes}
                    expanded={allExpanded}
                  />
                )
              })}
            </Stack>
          </Stack>
        )}
      </Box>
      <NonPLItemsBreakdown />
    </>
  )
}

export default ExpenseBreakdown
