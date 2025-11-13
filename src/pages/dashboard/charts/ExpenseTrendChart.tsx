import {
  Card,
  CardContent,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

interface ExpenseTrendChartProps {
  data: any
  granularity: string
  month: number | null
  year: number
}

const ExpenseTrendChart = ({ data }: ExpenseTrendChartProps) => {
  const theme = useTheme()

  // ✅ Responsive radius based on screen size breakpoints
  const isXs = useMediaQuery(theme.breakpoints.down('sm'))
  const isMd = useMediaQuery(theme.breakpoints.between('sm', 'md'))

  // ✅ Dynamically adjust radius
  const barRadius = isXs ? 12 : isMd ? 12 : 26
  const currentCategories = data?.current?.expense_types || []
  const previousCategories = data?.previous?.expense_types || []

  const previousMap: Record<string, number> = {}
  previousCategories.forEach((item: any) => {
    previousMap[item.expense_type] = parseFloat(item.amount)
  })

  const chartData = currentCategories.map((item: any) => ({
    category: item.expense_type,
    current: parseFloat(item.amount),
    previous: previousMap[item.expense_type] || 0
  }))

  return (
    <Card>
      <CardContent>
        <Typography variant='h6' mb={1}>
          Expense Trends ({data?.current?.label} vs {data?.previous?.label})
        </Typography>

        <ResponsiveContainer width='100%' height={320}>
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 20, left: 0, bottom: 70 }}
            barCategoryGap='15%' // constant category spacing
            barGap='5%' // constant bar spacing
          >
            <XAxis
              dataKey='category'
              angle={-30}
              textAnchor='end'
              interval={0}
            />
            <YAxis />
            <Tooltip
              formatter={(v: number) => `£${v.toLocaleString()}`}
              labelFormatter={(v) => `Category: ${v}`}
            />
            <Legend
              layout='horizontal'
              verticalAlign='top'
              align='right'
              iconType='circle'
            />
            <Bar
              dataKey='current'
              fill='#0288D1'
              name={`Current (${data?.current?.label})`}
              radius={[barRadius, barRadius, 0, 0]} // ✅ responsive radius
            />
            <Bar
              dataKey='previous'
              fill='#b0b0b0ff'
              name={`Previous (${data?.previous?.label})`}
              radius={[barRadius, barRadius, 0, 0]} // ✅ responsive radius
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export default ExpenseTrendChart
