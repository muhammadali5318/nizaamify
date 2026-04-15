import { Box } from '@mui/material'
import ModuleHeader from 'src/components/module-header'
import { ExpenseHeaderProps } from '../../types'
import dayjs from 'dayjs'
import { useState } from 'react'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import PeriodSelector from 'src/pages/dashboard/components/PeriodSelector'
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers'

const ExpensePageHeader = ({
  avatarSrc,
  heading,
  onDateChange,
  subheading,
  tooltipText,
  showDownloadBtn = true
}: ExpenseHeaderProps) => {
  const [selectedPeriod, setSelectedPeriod] = useState('Last month')
  const [selectedMonth, setSelectedMonth] = useState(
    dayjs().subtract(1, 'month')
  )

  const applySelectedMonth = (monthDayjs: dayjs.Dayjs) => {
    if (!monthDayjs) return
    onDateChange({
      start: monthDayjs.startOf('month').toISOString(),
      end: monthDayjs.endOf('month').toISOString()
    })
  }

  return (
    <>
      <Box
        sx={{
          pt: 2,
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
          tooltipText={tooltipText}
        />

        {showDownloadBtn && (
          <Box
            sx={{
              width: { xs: '100%', sm: 'auto' },
              display: 'flex',
              gap: 1,
              alignItems: 'center',
              position: 'relative'
            }}
          >
            <Box
              sx={{
                mb: 0,
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'start', sm: 'center' },
                gap: 1
              }}
            >
              <Box>
                {selectedPeriod === 'Last month' && (
                  <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <DatePicker
                      views={['year', 'month']}
                      label='Select Month'
                      value={selectedMonth}
                      onChange={(newValue: any) => {
                        setSelectedMonth(newValue)
                        setSelectedPeriod('Last month')
                        applySelectedMonth(newValue)
                      }}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          sx: {
                            '& .MuiPickersInputBase-root': {
                              borderRadius: '12px'
                            },
                            size: 'small',
                            '& input': { padding: '8px 0px 8px 12px' }
                          }
                        }
                      }}
                    />
                  </LocalizationProvider>
                )}
              </Box>

              <PeriodSelector
                options={['Last month', '3-month view', 'Yearly']}
                selected={selectedPeriod}
                onSelect={(period) => {
                  setSelectedPeriod(period)

                  if (period === 'Last month') {
                    const lastMonth = dayjs().subtract(1, 'month')
                    setSelectedMonth(lastMonth)
                    applySelectedMonth(lastMonth)
                  } else if (period === '3-month view') {
                    const start = dayjs().subtract(2, 'month').startOf('month')
                    const end = dayjs().endOf('month')
                    onDateChange({
                      start: start.toISOString(),
                      end: end.toISOString()
                    })
                  } else if (period === 'Yearly') {
                    const start = dayjs().startOf('year')
                    const end = dayjs().endOf('year')
                    onDateChange({
                      start: start.toISOString(),
                      end: end.toISOString()
                    })
                  }
                }}
              />
            </Box>
          </Box>
        )}
      </Box>
    </>
  )
}

export default ExpensePageHeader
