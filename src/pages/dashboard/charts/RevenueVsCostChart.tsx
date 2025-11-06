import { Box, Card, CardContent, Typography } from '@mui/material'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import revenueIcon from '../../../assets/revenue-cost-icon.svg'

const data = [
  { name: 'Jan', Revenue: 95000, Cost: 60000 },
  { name: 'Feb', Revenue: 87000, Cost: 65000 },
  { name: 'Mar', Revenue: 102000, Cost: 72000 },
  { name: 'Apr', Revenue: 98000, Cost: 70000 },
  { name: 'May', Revenue: 105000, Cost: 75000 },
  { name: 'Jun', Revenue: 92000, Cost: 68000 }
]

const RevenueVsCostChart = () => (
  <Card sx={{ backgroundColor: '#FAFAFA', width: '100%' }}>
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
        <img src={revenueIcon} alt='Revenue vs Cost' />
        <Typography variant='h6' mb={1}>
          Revenue vs Cost
        </Typography>
      </Box>
      <ResponsiveContainer width='100%' height={250}>
        <BarChart data={data}>
          <XAxis dataKey='name' />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar
            dataKey='Revenue'
            fill='#0288D1'
            radius={[12, 12, 0, 0]}
            barSize={12.5}
          />
          <Bar
            dataKey='Cost'
            fill='#E0E0E0'
            radius={[12, 12, 0, 0]}
            barSize={12.5}
          />
        </BarChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
)

export default RevenueVsCostChart
