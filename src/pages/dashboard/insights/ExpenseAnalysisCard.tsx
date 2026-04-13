import { Typography, Stack, Chip, Box } from '@mui/material'
import expenseIcon from '../../../assets/expense-analysis-icon.svg'

interface ExpenseItem {
  category: string
  current_amount: string
  share_of_revenue_percent: string
  inline: boolean
}

interface ExpenseAnalysisCardProps {
  expenseAnalysis: ExpenseItem[]
  total: string
}

const ExpenseAnalysisCard = ({
  expenseAnalysis = [],
  total
}: ExpenseAnalysisCardProps) => (
  <Box
    sx={{
      borderRadius: '20px',
      background: '#fff',
      padding: '10px',
      height: '100%'
    }}
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
      <img src={expenseIcon} alt='Revenue vs Cost' />
      <Typography variant='h6' mb={1}>
        Expense Analysis
      </Typography>
    </Box>

    <Typography variant='h4' color='primary' fontWeight={600}>
      £{total}
    </Typography>
    <Typography variant='body2' color='text.secondary'>
      Total expenses this month
    </Typography>

    <Stack spacing={1} mt={2}>
      {expenseAnalysis?.map((item, index) => (
        <Stack key={index} direction='row' alignItems='center'>
          <Typography sx={{ flex: 1 }}>{item.category}:</Typography>

          <Typography
            sx={{
              flex: 1,
              textAlign: 'center'
            }}
          >
            {item.share_of_revenue_percent}%
          </Typography>

          <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
            <Chip
              label={
                item.inline
                  ? 'In line with benchmark'
                  : 'Not in line with benchmark'
              }
              sx={{
                color: item.inline ? '#2E7D32' : '#D32F2F',
                backgroundColor: '#fff',
                border: `1px solid ${item.inline ? '#2E7D32' : '#D32F2F'}`
              }}
              size='small'
            />
          </Box>
        </Stack>
      ))}
    </Stack>
  </Box>
)

export default ExpenseAnalysisCard
