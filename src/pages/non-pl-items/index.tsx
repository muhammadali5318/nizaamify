import { Box, CircularProgress } from '@mui/material'
import styles from './nonPLItemsBreakdown.module.scss'
import ExpensePageHeader from '../expense-breakdown/components/expense-header/ExpensePageHeader'
import ExpensesGrandTotal from '../expense-breakdown/components/expense-header'
import ReusableAccordion from '../expense-breakdown/components/expense-accordion'
import { useState } from 'react'
import dayjs from 'dayjs'
import { RangeISO } from 'src/components/date-range-selector'
import { formatAmountWithCommas } from 'src/utils/stringUtils'
import { useFetchNonPLBreakdown } from 'src/hooks/useFetchNonPLBreakdown'
import { useActivePractice } from 'src/hooks/useActivePractice'
import { mapExpenseSubtypes } from './types'

const NonPLItemsBreakdown = () => {
  const { activePracticeId } = useActivePractice()

  const lastMonth = dayjs().subtract(1, 'month')

  const [dateRange, setDateRange] = useState<RangeISO>({
    start: lastMonth.startOf('month').toISOString(),
    end: lastMonth.endOf('month').toISOString()
  })

  const { data, loading } = useFetchNonPLBreakdown({
    practiceId: activePracticeId!,
    startDate: dayjs(dateRange.start).format('YYYY-MM-DD'),
    endDate: dayjs(dateRange.end).format('YYYY-MM-DD')
  })

  return (
    <Box className={styles.nonPLItemsBreakdownRoot} width='100%'>
      {/* HEADER (always mounted so state does not reset) */}
      <ExpensePageHeader
        heading='Non P&L Items Breakdown'
        dateRange={dateRange}
        onDateChange={setDateRange}
        avatarSrc='/assets/non-pl-green-icon.svg'
        subheading='Detailed view of all Non P&L items categories and subcategories'
        showDownloadBtn={false}
        allExpanded={false}
        setAllExpanded={() => {}}
        tooltipText='Items such as owners withdrawals, capital loans/injections or tax matters which do not belong in the P&L statement are recorded here'
      />

      {/* LOADING STATE */}
      {loading && (
        <Box display='flex' justifyContent='center' mt={4} width={'100%'}>
          <CircularProgress />
        </Box>
      )}

      {/* CONTENT */}
      {!loading && data && (
        <>
          <ExpensesGrandTotal
            total={formatAmountWithCommas(data.total)}
            label='Total Monthly Non P&L Items Expenses:'
          />

          {data.categories.map((category, idx) => {
            const expenseType = data.expense_type.find(
              (item) => item.expense_type === category.parent_category
            )

            return (
              <ReusableAccordion
                key={idx}
                title={category.parent_category}
                dateRange={dateRange}
                total={category.amount}
                chips={[
                  `${expenseType?.expense_subtypes?.length ?? 0} subcategories`
                ]}
                expenseSubtypes={mapExpenseSubtypes(expenseType)}
              />
            )
          })}
        </>
      )}
    </Box>
  )
}

export default NonPLItemsBreakdown
