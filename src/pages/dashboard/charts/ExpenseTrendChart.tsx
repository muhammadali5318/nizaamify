import { Card, CardContent, Typography } from '@mui/material'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

const data = [
  { category: 'Staff', thisMonth: 50000, lastMonth: 47000 },
  { category: 'Clinician pay', thisMonth: 60000, lastMonth: 58000 },
  { category: 'Lab fees', thisMonth: 15000, lastMonth: 18000 },
  { category: 'Materials', thisMonth: 12000, lastMonth: 13000 },
  { category: 'Premises', thisMonth: 8000, lastMonth: 7800 },
  { category: 'Marketing', thisMonth: 4000, lastMonth: 4200 }
]

const ExpenseTrendChart = () => (
  <Card>
    <CardContent>
      <Typography variant='h6' mb={1}>
        Expense Trends
      </Typography>
      <ResponsiveContainer width='100%' height={250}>
        <BarChart data={data}>
          <XAxis dataKey='category' />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar
            dataKey='thisMonth'
            fill='#0288D1'
            name='This month'
            radius={[12, 12, 0, 0]}
            barSize={39.4}
          />
          <Bar
            dataKey='lastMonth'
            fill='#E0E0E0'
            name='Last month'
            radius={[12, 12, 0, 0]}
            barSize={39.4}
          />
        </BarChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
)

export default ExpenseTrendChart
