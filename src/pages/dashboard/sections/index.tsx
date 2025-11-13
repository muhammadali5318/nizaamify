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

const MainDashboard = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('Current month')
  const [expenseData, setExpenseData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const { activePracticeId } = useActivePractice()

  const getDateRange = (label: string) => {
    const endDate = dayjs()
    let startDate
    let granularity: 'month' | 'quarter' | 'year'
    let month: number | null = null
    const year = endDate.year()

    switch (label) {
      case 'Current month':
        startDate = endDate.startOf('month')
        granularity = 'month'
        month = endDate.month() + 1
        break

      case '3-month view':
        startDate = endDate.subtract(3, 'month').startOf('month')
        granularity = 'quarter'
        month = startDate.month() + 1
        break

      case 'Yearly':
        startDate = endDate.subtract(12, 'month').startOf('year')
        granularity = 'year'
        month = null
        break

      default:
        startDate = endDate.startOf('month')
        granularity = 'month'
        month = endDate.month() + 1
    }

    return {
      start_date: startDate.format('YYYY-MM-DD'),
      end_date: endDate.format('YYYY-MM-DD'),
      granularity,
      month,
      year
    }
  }

  const { start_date, end_date, granularity, month, year } =
    getDateRange(selectedPeriod)

  // Fetch expense data
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
    <Box display='flex' flexDirection='column' gap={2}>
      {/* Header + Period Selector */}
      <Box
        mb={1}
        sx={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <Typography variant='h6' fontWeight={600}>
          Practice Financial Overview
        </Typography>

        <PeriodSelector
          options={['Current month', '3-month view', 'Yearly']}
          selected={selectedPeriod}
          onSelect={setSelectedPeriod}
        />
      </Box>

      {/* 1. KPI Cards */}
      <DashboardStatsSection
        selectedPeriod={selectedPeriod}
        startDate={start_date}
        endDate={end_date}
      />

      {/* 2. Revenue & Profit Charts */}

      {/* 3. Expense Breakdown & Trends */}
      <Box
        display='flex'
        flexDirection='column'
        gap={2}
        sx={{ backgroundColor: '#fafafa', borderRadius: '12px', p: 2 }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <img src={expenseIcon} alt='Expense' />
          <Typography variant='h6' mb={1}>
            Expense Breakdown & Trends
          </Typography>
        </Box>

        {loading ? (
          <CircularProgress
            size={28}
            thickness={4}
            sx={{ color: '#000', alignSelf: 'center' }}
          />
        ) : (
          <Box
            display='flex'
            flexDirection={{ xs: 'column', md: 'row' }}
            gap={2}
          >
            <Box flex={1}>
              <ExpenseBreakdownChart
                data={expenseData}
                granularity={granularity}
                month={month}
                year={year}
              />
            </Box>
            {/* <Box flex={1.3}>
              <ExpenseTrendChart
                data={expenseData}
                granularity={granularity}
                month={month}
                year={year}
              />
            </Box> */}
          </Box>
        )}
      </Box>

      {/* 4. Benchmark Table */}

      <Box display='flex' flexDirection={{ xs: 'column', md: 'row' }} gap={2}>
        {/* <Box flex={1}>
              <ExpenseBreakdownChart
                data={expenseData}
                granularity={granularity}
                month={month}
                year={year}
              />
            </Box> */}
        <Box flex={1.3}>
          <ExpenseTrendChart
            data={expenseData}
            granularity={granularity}
            month={month}
            year={year}
          />
        </Box>
      </Box>

      <Box
        mt={1}
        sx={{ backgroundColor: '#fafafa', borderRadius: '12px', p: 2 }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <img src={benchmarkIcon} alt='Benchmark' />
          <Typography variant='h6' mb={1}>
            Benchmark Comparison (as % of Revenue)
          </Typography>
        </Box>
        <BenchmarkComparisonTable data={expenseData} />
      </Box>
      <Box
        display='flex'
        flexDirection={{ xs: 'column', md: 'row' }}
        gap={{ xs: 2, md: 0 }}
        sx={{ backgroundColor: '#fff', borderRadius: '12px', width: '100%' }}
      >
        <Box flex={1.4} mr={2}>
          <RevenueVsCostChart />
        </Box>
        <Box flex={1}>
          <ProfitMarginTrendChart />
        </Box>
      </Box>
      {/* 5. AI Insights */}
      <Box
        display='flex'
        flexDirection='column'
        gap={2}
        sx={{ backgroundColor: '#FAFAFA', p: 2, borderRadius: '12px' }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <img src={aiIcon} alt='AI Insights' />
          <Typography variant='h6' mb={1}>
            AI-Driven Insights
          </Typography>
        </Box>
        <Box display='flex' flexDirection={{ xs: 'column', md: 'row' }} gap={2}>
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
