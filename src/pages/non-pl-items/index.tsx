import { Box, CircularProgress, Stack } from '@mui/material'
import styles from './nonPLItemsBreakdown.module.scss'
import ExpensePageHeader from '../expense-breakdown/components/expense-header/ExpensePageHeader'
import ExpensesGrandTotal from '../expense-breakdown/components/expense-header'
import ReusableAccordion from '../expense-breakdown/components/expense-accordion'
import { RangeISO } from 'src/components/date-range-selector'
import { formatAmountWithCommas } from 'src/utils/stringUtils'
import { mapExpenseSubtypes } from './types'
import { useFetchNonPL } from './hooks/useFetchNonPL'

type NonPLItemsBreakdownProps = {
  dateRange: RangeISO
  onDateChange: (range: RangeISO) => void
}

const NonPLItemsBreakdown = ({
  dateRange,
  onDateChange
}: NonPLItemsBreakdownProps) => {
  const startDate = dateRange.start
    ? new Date(dateRange.start).toISOString().slice(0, 10)
    : null

  const endDate = dateRange.end
    ? new Date(dateRange.end).toISOString().slice(0, 10)
    : null

  const { data, isPending } = useFetchNonPL({
    enabled: !!startDate && !!endDate,
    startDate,
    endDate
  })

  return (
    <Box className={styles.nonPLItemsBreakdownRoot} width='100%'>
      <ExpensePageHeader
        heading='Non P&L Items Breakdown'
        dateRange={dateRange}
        onDateChange={onDateChange}
        avatarSrc='/assets/non-pl-green-icon.svg'
        subheading='Detailed view of all Non P&L items categories and subcategories'
        showDownloadBtn={false}
        allExpanded={false}
        setAllExpanded={() => {}}
        tooltipText='Items such as owners withdrawals, capital loans/injections or tax matters which do not belong in the P&L statement are recorded here'
      />

      {isPending && (
        <Box display='flex' justifyContent='center' mt={4} width='100%'>
          <CircularProgress />
        </Box>
      )}

      {/* CONTENT */}
      {!isPending && data && (
        <Stack
          spacing={2}
          sx={{
            borderRadius: '24px',
            border: '1px solid var(--grey-200)',
            padding: 2
          }}
          width={'100%'}
        >
          <ExpensesGrandTotal
            total={formatAmountWithCommas(data.total)}
            label='Total Monthly Non P&L Items Expenses:'
          />

          {data?.categories?.map((category, idx) => {
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
        </Stack>
      )}
    </Box>
  )
}

export default NonPLItemsBreakdown
