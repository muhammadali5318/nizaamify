import { Box, CircularProgress, Typography, Button, Stack } from '@mui/material'
import { useEffect, useState, useRef } from 'react'
import dayjs from 'dayjs'

import DashboardStatsSection from './dashboard-stats-section/DashboardStatsSection'
import RevenueVsCostChart from '../charts/RevenueVsCostChart'
import ProfitMarginTrendChart from '../charts/ProfitMarginTrendChart'
import ExpenseBreakdownChart from '../charts/ExpenseBreakdownChart'
import ExpenseTrendChart from '../charts/ExpenseTrendChart'
import ExpandableBenchmarkTable from '../charts/BenchmarkComparisonTable'
import PeriodSelector from '../components/PeriodSelector'
import downlaodBtn from '../../../assets/document-download-black.svg'
import expenseIcon from '../../../assets/expense-icon.svg'

import { getExpenseData } from '../../../services/apis/expense'
import { useActivePractice } from 'src/hooks/useActivePractice'
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'

import { downloadDashboardPDF } from '../utils/downloadPdf'
import SubmitFeedback from '../components/submit-feedback'
import AiSummary from '../components/ai-summary'

const MainDashboard = () => {
  // default to Last month
  const [selectedPeriod, setSelectedPeriod] = useState('Last month')
  const [expenseData, setExpenseData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const { activePracticeId } = useActivePractice()
  // default selected month -> last month
  const [selectedMonth, setSelectedMonth] = useState(
    dayjs().subtract(1, 'month')
  )

  const dashboardRef = useRef<any>(null)
  const feedbackRef = useRef<any>(null)

  const getDateRange = (label: string) => {
    let endDate = dayjs()
    let startDate
    let granularity: 'month' | 'quarter' | 'year'
    let month: number | null = null
    let year = endDate.year()

    switch (label) {
      case 'Last month': {
        // prefer user-selected month, otherwise last month relative to today
        const target = selectedMonth ?? dayjs().subtract(1, 'month')
        startDate = target.startOf('month')
        endDate = target.endOf('month')
        granularity = 'month'
        month = target.month() + 1
        year = target.year()
        break
      }

      case '3-month view':
        endDate = dayjs()
        startDate = endDate.subtract(2, 'month').startOf('month')
        granularity = 'quarter'
        month = endDate.month() + 1
        year = endDate.year()
        break

      case 'Yearly':
        endDate = dayjs()
        startDate = endDate.startOf('year')
        granularity = 'year'
        month = null
        year = endDate.year()
        break

      default: {
        // fallback to Last month semantics
        const target = selectedMonth ?? dayjs().subtract(1, 'month')
        startDate = target.startOf('month')
        endDate = target.endOf('month')
        granularity = 'month'
        month = target.month() + 1
        year = target.year()
      }
    }

    return {
      start_date: startDate.format('DD-MM-YYYY'),
      end_date: endDate.format('DD-MM-YYYY'),
      granularity,
      month,
      year
    }
  }

  const { granularity, month, year } = getDateRange(selectedPeriod)

  useEffect(() => {
    const fetchExpenseData = async () => {
      if (!activePracticeId) {
        setExpenseData(null)
        return
      }
      setLoading(true)
      try {
        const data = await getExpenseData(
          activePracticeId,
          granularity,
          year,
          month
        )
        setExpenseData(data)
      } catch (error) {
        console.error('Failed to load expense data', error)
      } finally {
        setLoading(false)
      }
    }

    fetchExpenseData()
  }, [selectedPeriod, granularity, month, year, activePracticeId])

  return (
    <Box display='flex' flexDirection='column' gap={2} sx={{ width: '100%' }}>
      {/* HEADER */}
      <Box
        mb={1}
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'start', sm: 'center' },
          gap: 1
        }}
      >
        <Typography variant='h6' fontWeight={600}>
          Practice Financial Overview
        </Typography>

        <Box
          mb={1}
          sx={{
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
                  }}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      sx: {
                        '& .MuiPickersInputBase-root': { borderRadius: '12px' },
                        size: 'small'
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
                setSelectedMonth(dayjs().subtract(1, 'month'))
              }
            }}
          />

          <Button
            variant='contained'
            startIcon={<img src={downlaodBtn} alt='Download' />}
            sx={{
              borderRadius: '10px',
              height: 55,
              backgroundColor: '#fff',
              color: '#000',
              border: '1px solid #E0E0E0',
              boxShadow: 'none'
            }}
            onClick={() =>
              downloadDashboardPDF(
                dashboardRef,
                feedbackRef,
                'Financial-Dashboard'
              )
            }
          >
            Download PDF
          </Button>
        </Box>
      </Box>
      <Stack spacing={2.5} ref={dashboardRef}>
        {/* KPI CARDS */}
        <DashboardStatsSection
          granularity={granularity}
          month={month}
          year={year}
        />
        {/* EXPENSE SECTION */}
        <Box
          sx={{
            backgroundColor: '#fafafa',
            borderRadius: '12px',
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 2
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <img src={expenseIcon} alt='Expense' />
            <Typography variant='h6'>Expense Breakdown & Trends</Typography>
          </Box>

          {loading ? (
            <CircularProgress
              size={28}
              sx={{ alignSelf: 'center', color: '#000' }}
            />
          ) : (
            <Box
              display='flex'
              flexDirection={{ xs: 'column', md: 'row' }}
              gap={2}
              sx={{ width: '100%' }}
            >
              <Box flex={1} sx={{ minHeight: 250 }}>
                <ExpenseBreakdownChart
                  data={expenseData}
                  granularity={granularity}
                  month={month}
                  year={year}
                />
              </Box>
            </Box>
          )}
        </Box>
        {/* EXPENSE TREND */}
        <Box display='flex' flexDirection={{ xs: 'column', md: 'row' }} gap={2}>
          <Box flex={1} sx={{ minHeight: 280 }}>
            <ExpenseTrendChart
              data={expenseData}
              granularity={granularity}
              month={month}
              year={year}
            />
          </Box>
        </Box>
        {/* BENCHMARK TABLE */}
        <ExpandableBenchmarkTable data={expenseData} />
        {/* REVENUE VS PROFIT SECTION */}
        <Box
          display='flex'
          flexDirection={{ xs: 'column', md: 'row' }}
          gap={2}
          sx={{ width: '100%' }}
        >
          <Box flex={1} sx={{ minHeight: 280 }}>
            <RevenueVsCostChart
              granularity={granularity}
              month={month}
              year={year}
              practiceId={activePracticeId}
            />
          </Box>

          <Box flex={1} sx={{ minHeight: 280 }}>
            <ProfitMarginTrendChart
              granularity={granularity}
              month={month}
              year={year}
              practiceId={activePracticeId}
            />
          </Box>
        </Box>
      </Stack>
      <Stack spacing={2.4} ref={feedbackRef}>
        {/* AI INSIGHTS */}
        <AiSummary granularity={granularity} month={month} year={year} />
        <SubmitFeedback />
      </Stack>
    </Box>
  )
}

export default MainDashboard
