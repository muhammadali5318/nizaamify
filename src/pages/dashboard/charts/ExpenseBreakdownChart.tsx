import { Card, CardContent, Typography } from '@mui/material'
import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

const data = [
  { name: 'Clinician pay', value: 40 },
  { name: 'Lab fees', value: 10 },
  { name: 'Staff', value: 25 },
  { name: 'Marketing', value: 5 },
  { name: 'Materials', value: 10 },
  { name: 'Premises', value: 10 }
]

const COLORS = [
  '#0088FE',
  '#00C49F',
  '#FFBB28',
  '#FF8042',
  '#AF19FF',
  '#FF4D4F'
]

const ExpenseBreakdownChart = () => (
  <Card>
    <CardContent>
      <Typography variant='h6' mb={1}>
        Expense Breakdown (as % of revenue){' '}
      </Typography>
      <ResponsiveContainer width='100%' height={250}>
        <PieChart>
          <Legend align='right' amplitude={20} />

          <Pie
            data={data}
            cx='20%'
            cy='50%'
            innerRadius='50%'
            outerRadius='80%'
            dataKey='value'
            label
            paddingAngle={1}
          >
            {data.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
)

export default ExpenseBreakdownChart
