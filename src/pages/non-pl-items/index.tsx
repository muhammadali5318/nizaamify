import { Box } from '@mui/material'
import styles from './nonPLItemsBreakdown.module.scss'
import ExpensePageHeader from '../expense-breakdown/components/expense-header/ExpensePageHeader'
import ExpensesGrandTotal from '../expense-breakdown/components/expense-header'
import ReusableAccordion from '../expense-breakdown/components/expense-accordion'
import { useState } from 'react'
import dayjs from 'dayjs'
import { RangeISO } from 'src/components/date-range-selector'
import { formatAmountWithCommas } from 'src/utils/stringUtils'
import { dummyNonPLData } from './dummyNonPLData'

const NonPLItemsBreakdown = () => {
  const [dateRange, setDateRange] = useState<RangeISO>({
    start: dayjs().startOf('month').toISOString(),
    end: dayjs().endOf('month').toISOString()
  })

  const data = dummyNonPLData

  return (
    <Box className={styles.nonPLItemsBreakdownRoot} width='100%'>
      {/* Header with date selector */}
      <ExpensePageHeader
        heading='Non P&L Items Breakdown'
        dateRange={dateRange}
        onDateChange={setDateRange}
        avatarSrc='/assets/non-pl-green-icon.svg'
        subheading='Detailed view of all Non P&L items categories and subcategories'
      />

      {/* Grand total */}
      <ExpensesGrandTotal
        total={formatAmountWithCommas(data.total)}
        label='Total Monthly Non P&L Items Expenses:'
      />

      {/* Categories */}
      {dummyNonPLData.categories.map((category, idx) => {
        const nonPLType = dummyNonPLData.non_pl_type.find(
          (item) => item.non_pl_type === category.parent_category
        )

        return (
          <ReusableAccordion
            key={idx}
            title={category.parent_category}
            dateRange={dateRange}
            total={category.amount}
            chips={[`${nonPLType?.non_pl_subtypes?.length ?? 0} subcategories`]}
            expenseSubtypes={
              nonPLType?.non_pl_subtypes?.map((subtype) => ({
                name: subtype.name,
                amount: subtype.amount,
                line_items: subtype.line_items.map((item) => ({
                  name: item.name,
                  amount: item.amount
                }))
              })) ?? []
            }
          />
        )
      })}
    </Box>
  )
}

export default NonPLItemsBreakdown
