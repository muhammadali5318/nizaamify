import {
  Card,
  CardContent,
  Typography,
  Box,
  useMediaQuery,
  useTheme
} from '@mui/material'
import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

interface ExpenseBreakdownChartProps {
  granularity: string
  month: number | null
  year: number
  data?: any
}

const COLORS = [
  '#5B8FF9',
  '#5AD8A6',
  '#5D7092',
  '#F6BD16',
  '#E8684A',
  '#1ca0dd',
  '#9270CA',
  '#FF9D4D',
  '#269A99',
  '#FF99C3'
]

const ExpenseBreakdownChart = ({ data }: ExpenseBreakdownChartProps) => {
  const chartData =
    data?.current?.expense_types?.map((item: any) => ({
      name: item?.expense_type,
      value: parseFloat(item?.share_of_total_percent || 0),
      amount: parseFloat(item?.amount || 0)
    })) || []

  const theme = useTheme()

  const isXs = useMediaQuery(theme.breakpoints.down('sm'))
  const isMd = useMediaQuery(theme.breakpoints.between('sm', 'md'))
  const isLg = useMediaQuery(theme.breakpoints.up('md'))

  // Adjust Pie radii based on screen size
  let innerRadius = '35%'
  let outerRadius = '60%'
  if (isXs) {
    innerRadius = '25%'
    outerRadius = '45%'
  } else if (isMd) {
    innerRadius = '30%'
    outerRadius = '55%'
  } else if (isLg) {
    innerRadius = '35%'
    outerRadius = '60%'
  }

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: 1 }}>
        <Typography variant='h6' mb={2}>
          Expense Breakdown (as % of total)
        </Typography>

        <Box sx={{ width: '100%', height: 320 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={chartData}
                cx='50%'
                cy='50%'
                innerRadius={innerRadius}
                outerRadius={outerRadius}
                cornerRadius={6}
                dataKey='value'
                paddingAngle={2}
              >
                {chartData.map((_: any, index: any) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                    stroke='#fefefe'
                    strokeWidth={1}
                  />
                ))}
              </Pie>

              <Legend
                verticalAlign='middle'
                align='right'
                layout='vertical'
                iconType='circle'
                formatter={(value: string) => {
                  const percentage = chartData
                    .find((d: any) => d.name === value)
                    ?.value?.toFixed(1)
                  return `${value} (${percentage}%)`
                }}
                wrapperStyle={{
                  paddingLeft: '10px',
                  width: isXs ? '35%' : '40%',
                  fontSize: '0.9rem',
                  lineHeight: '1.5'
                }}
              />

              <Tooltip
                formatter={(value: number, name: string, props: any) => {
                  const { payload } = props
                  return [
                    `  ${payload.amount?.toLocaleString?.() ?? 0} (${value.toFixed(2)}%)`,
                    name
                  ]
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  )
}

export default ExpenseBreakdownChart
