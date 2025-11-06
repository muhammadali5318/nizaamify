import { Card, CardContent, Typography, Stack, Chip, Box } from '@mui/material'
import expenseIcon from '../../../assets/expense-analysis-icon.svg'
const ExpenseAnalysisCard = () => (
  <Card>
    <CardContent>
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
        £48,000
      </Typography>
      <Typography variant='body2' color='text.secondary'>
        Total expenses this month
      </Typography>

      <Stack spacing={1} mt={2}>
        <Stack direction='row' justifyContent='space-between'>
          <Typography>Clinician cost</Typography>
          <Chip
            label='In line with benchmark'
            sx={{
              color: '#2E7D32',
              backgroundColor: '#fff',
              border: '1px solid #2E7D32'
            }}
            size='small'
          />
        </Stack>
        <Stack direction='row' justifyContent='space-between'>
          <Typography>Lab fees</Typography>
          <Chip
            label='In line with benchmark'
            sx={{
              color: '#2E7D32',
              backgroundColor: '#fff',
              border: '1px solid #2E7D32'
            }}
            size='small'
          />
        </Stack>
        <Stack direction='row' justifyContent='space-between'>
          <Typography>Occupancy</Typography>
          <Chip
            label='Not in line with benchmark'
            sx={{
              color: '#D32F2F',
              backgroundColor: '#fff',
              border: '1px solid #D32F2F'
            }}
            size='small'
          />
        </Stack>
      </Stack>
    </CardContent>
  </Card>
)

export default ExpenseAnalysisCard
