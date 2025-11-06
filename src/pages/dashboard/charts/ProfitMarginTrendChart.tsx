import { Box, Card, CardContent, Typography } from '@mui/material'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import profitIcon from '../../../assets/profit-margin-dash-icon.svg'
const data = [
  { month: 'Jan', margin: 10000 },
  { month: 'Feb', margin: 40000 },
  { month: 'Mar', margin: 20000 },
  { month: 'Apr', margin: 38000 },
  { month: 'May', margin: 42000 },
  { month: 'Jun', margin: 37000 }
]

const ProfitMarginTrendChart = () => (
  <Card sx={{ backgroundColor: '#FAFAFA' }}>
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
        <img src={profitIcon} alt='profit' />
        <Typography variant='h6' mb={1}>
          Profit Margin Trend
        </Typography>
      </Box>
      <ResponsiveContainer width='100%' height={250}>
        <LineChart data={data}>
          <XAxis dataKey='month' />
          <YAxis />
          <Tooltip />
          <Line
            type='linear'
            dataKey='margin'
            stroke='#0288D1'
            strokeWidth={2}
            dot={{ r: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
)

export default ProfitMarginTrendChart
