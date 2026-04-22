import { Box, Typography } from '@mui/material'
import AISummaryCard from '../../insights/AISummaryCard'
import ExpenseAnalysisCard from '../../insights/ExpenseAnalysisCard'
import aiIcon from 'src/assets/ai-icon.svg'
import { useFetchAIInsights } from 'src/hooks/useFetchAIInsights'
import { useAuth } from 'src/context/AuthProvider'

interface Props {
  granularity: string
  year: number
  month: any
}

const AiSummary = ({ granularity, month, year }: Props) => {
  const { accessToken } = useAuth()
  const { data } = useFetchAIInsights(!!accessToken, month, year, granularity)
  return (
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
        gap={2.5}
        alignItems='stretch'
        sx={{ width: '100%' }}
      >
        <Box flex={0.5}>
          <ExpenseAnalysisCard
            expenseAnalysis={data?.expense_analysis}
            total={data?.total_expense}
          />
        </Box>

        <Box flex={1}>
          <AISummaryCard aiInsight={data?.insight} />
        </Box>
      </Box>
    </Box>
  )
}

export default AiSummary
