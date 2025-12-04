import { Box, CircularProgress, Typography } from '@mui/material'
import { useEffect, useState } from 'react'
import dayjs from 'dayjs'

import DashboardStatsSection from './dashboard-stats-section/DashboardStatsSection'
import RevenueVsCostChart from '../charts/RevenueVsCostChart'
import ProfitMarginTrendChart from '../charts/ProfitMarginTrendChart'
import ExpenseBreakdownChart from '../charts/ExpenseBreakdownChart'
import ExpenseTrendChart from '../charts/ExpenseTrendChart'
import BenchmarkComparisonTable from '../charts/BenchmarkComparisonTable'
import ExpenseAnalysisCard from '../insights/ExpenseAnalysisCard'
import AISummaryCard from '../insights/AISummaryCard'
import PeriodSelector from '../components/PeriodSelector'

import expenseIcon from '../../../assets/expense-icon.svg'
import benchmarkIcon from '../../../assets/benchmark-comp-icon.svg'
import aiIcon from '../../../assets/ai-icon.svg'

import { getExpenseData } from '../../../services/apis/expense'
import { useActivePractice } from 'src/hooks/useActivePractice'
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'

const MainDashboard = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('Current month')
  const [expenseData, setExpenseData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const { activePracticeId } = useActivePractice()
  const [selectedMonth, setSelectedMonth] = useState(dayjs())

  const getDateRange = (label: string) => {
    const endDate = dayjs()
    let startDate
    let granularity: 'month' | 'quarter' | 'year'
    let month: number | null = null
    let year = endDate.year()

    switch (label) {
      case 'Current month':
        const targetDate = selectedMonth ?? endDate

        startDate = endDate.startOf('month')
        granularity = 'month'
        month = targetDate.month() + 1
        year = targetDate.year()
        break

      case '3-month view':
        startDate = endDate.subtract(2, 'month').startOf('month')
        granularity = 'quarter'
        month = endDate.month() + 1
        break

      case 'Yearly':
        startDate = endDate.startOf('year')
        granularity = 'year'
        month = null
        break

      default:
        startDate = endDate.startOf('month')
        granularity = 'month'
        month = endDate.month() + 1
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
            {' '}
            {selectedPeriod === 'Current month' && (
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  views={['year', 'month']}
                  label='Select Month'
                  value={selectedMonth}
                  onChange={(newValue: any) => {
                    setSelectedMonth(newValue)

                    setSelectedPeriod('Current month')
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
            options={['Current month', '3-month view', 'Yearly']}
            selected={selectedPeriod}
            onSelect={setSelectedPeriod}
          />
        </Box>
      </Box>

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
      <Box
        sx={{
          backgroundColor: '#fafafa',
          borderRadius: '12px',
          p: 2,
          width: '100%',
          overflowX: 'auto'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <img src={benchmarkIcon} alt='Benchmark' />
          <Typography variant='h6'>Benchmark Comparison</Typography>
        </Box>

        <BenchmarkComparisonTable data={expenseData} />
      </Box>

      {/* REVENUE VS PROFIT SECTION */}
      <Box
        display='flex'
        flexDirection={{ xs: 'column', md: 'row' }}
        gap={2}
        sx={{ width: '100%' }}
      >
        <Box flex={1.4} sx={{ minHeight: 280 }}>
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

      {/* AI INSIGHTS */}
      <Box
        sx={{
          backgroundColor: '#FAFAFA',
          p: 2,
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <img src={aiIcon} alt='AI Insights' />
          <Typography variant='h6'>AI-Driven Insights</Typography>
        </Box>

        <Box
          display='flex'
          flexDirection={{ xs: 'column', md: 'row' }}
          gap={2}
          sx={{ width: '100%' }}
        >
          <Box flex={1}>
            <ExpenseAnalysisCard />
          </Box>

          <Box flex={1}>
            <AISummaryCard />
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

export default MainDashboard
