import { Box } from '@mui/material'
import styles from './expenseBreakdown.module.scss'
import ExpensePageHeader from './components/expense-header/ExpensePageHeader'
import ExpensesGrandTotal from './components/expense-header'
import ReusableAccordion from './components/expense-accordion'
// First dummy dataset - General Practice Expenses

const ExpenseBreakdown = () => {
  return (
    <Box className={styles.expenseBreakdownRoot} width={'100%'}>
      <ExpensePageHeader />
      <ExpensesGrandTotal />
      <ReusableAccordion
        title='Business Operations'
        chips={['15 subcategories']}
        total={500}
      />
      <ReusableAccordion
        title='Business Operations'
        chips={['15 subcategories']}
        total={500}
      />

      <ReusableAccordion
        title='Business Operations'
        chips={['15 subcategories']}
        total={1000}
      />
    </Box>
  )
}

export default ExpenseBreakdown
