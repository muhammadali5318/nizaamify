import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import styles from './expenseBreakdown.module.scss'

import ExpensePageHeader from './components/expense-header/ExpensePageHeader'
import usePLTabs from './hooks/usePLTabs'
import { ReusableTabs } from 'src/components/tabs'
import { tabsData } from './expense-breakdown-config'
import {
  selectExpenseBreakdownDateRange,
  setDateRange
} from 'src/store/slices/expenseBreakdownSlice'
import { Box } from '@mui/material'

const ExpenseBreakdown = () => {
  const dispatch = useDispatch()
  const [allExpanded, setAllExpanded] = useState(false)
  const dateRange = useSelector(selectExpenseBreakdownDateRange)

  const tabs = usePLTabs()

  return (
    <Box className={styles.expenseBreakdownRoot} width='100%'>
      <ExpensePageHeader
        heading='P&L Items Breakdown'
        dateRange={dateRange}
        onDateChange={(range) => dispatch(setDateRange(range))}
        avatarSrc='/assets/wallet-bg-green.svg'
        subheading='Detailed view of P&L items categories and subcategories'
        allExpanded={allExpanded}
        setAllExpanded={setAllExpanded}
      />

      <ReusableTabs tabs={tabs} initialTab={tabsData[0].key} />
    </Box>
  )
}

export default ExpenseBreakdown
