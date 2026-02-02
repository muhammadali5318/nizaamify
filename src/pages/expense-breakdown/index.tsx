import { Box, CircularProgress, Typography } from '@mui/material'
import { useState } from 'react'
import dayjs from 'dayjs'

import styles from './expenseBreakdown.module.scss'
import ExpensePageHeader from './components/expense-header/ExpensePageHeader'
import ExpensesGrandTotal from './components/expense-header'
import ReusableAccordion from './components/expense-accordion'

import { useFetchExpenseBreakdown } from './hooks/useFetchExpenseBreakdown'
import { useAuth } from 'src/context/AuthProvider'
import { RangeISO } from 'src/components/date-range-selector'
import { formatAmountWithCommas } from 'src/utils/stringUtils'

const ExpenseBreakdown = () => {
  const { accessToken } = useAuth()

  // Date range state
  const [dateRange, setDateRange] = useState<RangeISO>({
    start: dayjs().startOf('year').toISOString(),
    end: dayjs().endOf('month').toISOString()
  })

  // Explicit date validity check (UX fix)
  const hasValidDate = Boolean(dateRange?.start) && Boolean(dateRange?.end)

  const { data, isPending } = useFetchExpenseBreakdown({
    enabled: !!accessToken && hasValidDate,
    startDate: dateRange.start,
    endDate: dateRange.end
  })

  return (
    <Box className={styles.expenseBreakdownRoot} width='100%'>
      <ExpensePageHeader
        heading='Expense Breakdown'
        dateRange={dateRange}
        onDateChange={setDateRange}
        avatarSrc='/assets/wallet-bg-green.svg'
        subheading='Detailed view of all expense categories and subcategories'
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
        <>
          <ExpensesGrandTotal
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
              />
            )
          })}
        </>
      )}
    </Box>
  )
}

export default ExpenseBreakdown
