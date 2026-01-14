import { Box, CircularProgress } from '@mui/material'
import styles from './expenseBreakdown.module.scss'
import ExpensePageHeader from './components/expense-header/ExpensePageHeader'
import ExpensesGrandTotal from './components/expense-header'
import ReusableAccordion from './components/expense-accordion'
import { useFetchExpenseBreakdown } from './hooks/useFetchExpenseBreakdown'
import { useAuth } from 'src/context/AuthProvider'
import dayjs from 'dayjs'
import { RangeISO } from 'src/components/date-range-selector'
import { useState } from 'react'
import { formatAmountWithCommas } from 'src/utils/stringUtils'

const ExpenseBreakdown = () => {
  const { accessToken } = useAuth()

  // ✅ Date state lives here
  const [dateRange, setDateRange] = useState<RangeISO>({
    start: dayjs().startOf('year').toISOString(),
    end: dayjs().endOf('month').toISOString()
  })

  const { data, isPending } = useFetchExpenseBreakdown({
    enabled: !!accessToken,
    startDate: dateRange.start,
    endDate: dateRange.end
  })

  return (
    <Box className={styles.expenseBreakdownRoot} width='100%'>
      {/* Pass date state down */}
      <ExpensePageHeader
        heading='Expense Breakdown'
        dateRange={dateRange}
        onDateChange={setDateRange}
        avatarSrc='/assets/wallet-bg-green.svg'
        subheading='Detailed view of all expense categories and subcategories'
      />
      {isPending ? (
        <Box
          width={'100%'}
          display='flex'
          alignItems='center'
          justifyContent='center'
          minHeight='20vh'
        >
          <CircularProgress />
        </Box>
      ) : (
        <>
          <ExpensesGrandTotal
            label='Total Monthly Expenses:'
            total={formatAmountWithCommas(data?.total) ?? 0}
          />

          {data?.categories?.map((category: any, idx: number) => {
            const expenseType = data?.expense_type.find(
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
                  `${expenseType?.expense_subtypes?.length} subcategories`
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
