import { Box } from '@mui/material'

import ModuleHeader from 'src/components/module-header'
import DateRangeSelector, { RangeISO } from 'src/components/date-range-selector'

type Props = {
  dateRange: RangeISO
  onDateChange: (range: RangeISO) => void
}

const ExpensePageHeader = ({ dateRange, onDateChange }: Props) => {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        flexWrap: 'wrap',
        rowGap: 2,
        '@media (max-width: 600px)': {
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 2
        }
      }}
    >
      <ModuleHeader
        avatarSrc='/assets/wallet-bg-green.svg'
        heading='Expense Breakdown'
        subheading='Detailed view of all expense categories and subcategories'
      />

      <Box sx={{ width: { xs: '100%', sm: '280px' } }}>
        <DateRangeSelector
          label='Select date range'
          value={dateRange}
          onChange={onDateChange}
        />
      </Box>
    </Box>
  )
}

export default ExpensePageHeader
