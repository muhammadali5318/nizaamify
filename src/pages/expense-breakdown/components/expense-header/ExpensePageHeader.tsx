import { Box } from '@mui/material'

import ModuleHeader from 'src/components/module-header'
import DateRangeSelector, { RangeISO } from 'src/components/date-range-selector'

type Props = {
  dateRange: RangeISO
  onDateChange: (range: RangeISO) => void
  heading?: string | any
  avatarSrc?: string | any
  subheading?: string | any
}

const ExpensePageHeader = ({
  avatarSrc,
  heading,
  dateRange,
  onDateChange,
  subheading
}: Props) => {
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
        avatarSrc={avatarSrc}
        heading={heading}
        subheading={subheading}
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
