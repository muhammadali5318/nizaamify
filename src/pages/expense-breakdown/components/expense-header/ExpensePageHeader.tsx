import ModuleHeader from 'src/components/module-header'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { LocalizationProvider } from '@mui/x-date-pickers'
import { Box } from '@mui/material'
import { useState } from 'react'
const ExpensePageHeader = () => {
  const [dateRange, setDateRange] = useState<[any, any]>([null, null])

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
      {/* LEFT: HEADER */}
      <ModuleHeader
        avatarSrc='/assets/wallet-bg-green.svg'
        heading={'Expense Breakdown'}
        subheading='Detailed view of all expense categories and subcategories'
      />

      {/* RIGHT: DATE PICKER */}
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <DatePicker
          format='DD/MM/YYYY'
          label='Select date'
          value={dateRange[0]}
          onChange={(newValue) => {
            setDateRange([newValue, dateRange[1]])
          }}
          slotProps={{
            textField: {
              fullWidth: false,
              sx: {
                width: { xs: '100%', sm: '240px' },
                '& .MuiPickersInputBase-root': {
                  borderRadius: '12px'
                }
              }
            }
          }}
        />
      </LocalizationProvider>
    </Box>
  )
}

export default ExpensePageHeader
