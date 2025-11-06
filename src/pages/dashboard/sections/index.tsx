import { Box, Typography } from '@mui/material'
import DashboardStatsSection from './dashboard-stats-section/DashboardStatsSection'
import RevenueVsCostChart from '../charts/RevenueVsCostChart'
import ProfitMarginTrendChart from '../charts/ProfitMarginTrendChart'
import ExpenseBreakdownChart from '../charts/ExpenseBreakdownChart'
import ExpenseTrendChart from '../charts/ExpenseTrendChart'
import BenchmarkComparisonTable from '../charts/BenchmarkComparisonTable'
import ExpenseAnalysisCard from '../insights/ExpenseAnalysisCard'
import AISummaryCard from '../insights/AISummaryCard'
import expenseIcon from '../../../assets/expense-icon.svg'
import benchmarkIcon from '../../../assets/benchmark-comp-icon.svg'
import aiIcon from '../../../assets/ai-icon.svg'
const MainDashboard = () => {
  return (
    <Box display='flex' flexDirection='column' gap={2}>
      {/* 1. KPI Cards */}
      <DashboardStatsSection />

      {/* 2. Revenue & Profit Charts */}
      <Box
        display='flex'
        flexDirection={{ xs: 'column', md: 'row' }}
        gap={{ xs: 2, md: 0 }}
        sx={{ backgroundColor: '#fff', borderRadius: '12px', width: '100%' }}
      >
        <Box>
          <Typography></Typography>
        </Box>
        <Box flex={1.4} mr={2}>
          <RevenueVsCostChart />
        </Box>
        <Box flex={1}>
          <ProfitMarginTrendChart />
        </Box>
      </Box>

      {/* 3. Expense Breakdown & Trends */}
      <Box
        display='flex'
        flexDirection={{ xs: 'column', md: 'column', lg: 'column' }}
        gap={2}
        sx={{ backgroundColor: '#fafafa', borderRadius: '12px', p: 2 }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'flex-start',
            alignItems: 'start',
            gap: 1,
            mb: 1,
            width: '100%'
          }}
        >
          <img src={expenseIcon} alt='Revenue vs Cost' />
          <Typography variant='h6' mb={1}>
            Expense Breakdown & Trends
          </Typography>
        </Box>
        <Box
          display='flex'
          flexDirection={{ xs: 'column', md: 'row' }}
          gap={2}
          width='100%'
        >
          <Box flex={1}>
            <ExpenseBreakdownChart />
          </Box>
          <Box flex={1.4}>
            <ExpenseTrendChart />
          </Box>
        </Box>
      </Box>

      {/* 4. Benchmark Table */}
      <Box
        mt={1}
        sx={{ backgroundColor: '#fafafa', borderRadius: '12px', p: 2 }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'flex-start',
            alignItems: 'start',
            gap: 1,
            mb: 1
          }}
        >
          <img src={benchmarkIcon} alt='Revenue vs Cost' />
          <Typography variant='h6' mb={1}>
            Benchmark Comparison (as % of Revenue)
          </Typography>
        </Box>
        <BenchmarkComparisonTable />
      </Box>

      {/* 5. AI Insights */}
      <Box
        display='flex'
        flexDirection={{ xs: 'column', md: 'column', lg: 'column' }}
        gap={2}
        sx={{ backgroundColor: '#FAFAFA', p: 2, borderRadius: '12px' }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'flex-start',
            alignItems: 'start',
            gap: 1,
            mb: 1
          }}
        >
          <img src={aiIcon} alt='Revenue vs Cost' />
          <Typography variant='h6' mb={1}>
            AI-Driven Insights
          </Typography>
        </Box>
        <Box
          display='flex'
          flexDirection={{ xs: 'column', md: 'row' }}
          gap={2}
          width='100%'
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
