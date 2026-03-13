import {
  Card,
  CardContent,
  Typography,
  Box,
  useMediaQuery,
  useTheme,
  Stack
} from '@mui/material'
import InsertChartOutlinedIcon from '@mui/icons-material/InsertChartOutlined'
import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

interface ExpenseBreakdownChartProps {
  granularity?: string
  month?: number | null
  year?: number
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
      name: item?.expense_type ?? 'Unknown',
      value: Number(parseFloat(item?.share_of_total_percent || 0)),
      amount: Number(parseFloat(item?.amount || 0))
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

  // Determine if there's any meaningful data
  const hasMeaningfulData =
    chartData.length > 0 &&
    chartData.some((d) => Number(d.value) > 0 || Number(d.amount) > 0)

  if (!hasMeaningfulData) {
    return (
      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flex: 1 }}>
          <Typography variant='h6' mb={2}>
            Expense Breakdown (as % of total)
          </Typography>

          <Box
            sx={{
              width: '100%',
              height: 320,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Stack spacing={1} alignItems='center'>
              <InsertChartOutlinedIcon
                sx={{ fontSize: 48, color: 'text.secondary' }}
              />
              <Typography variant='subtitle1'>No expense data</Typography>
              <Typography
                variant='body2'
                color='text.secondary'
                textAlign='center'
                sx={{ maxWidth: 360 }}
              >
                There are no expenses for the selected period. Try a different
                month/year or add transactions to view the breakdown.
              </Typography>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: 1 }}>
        <Typography variant='h6' mb={2}>
          Expense Breakdown (as % of total)
        </Typography>

        <Box sx={{ width: '100%', height: 320 }}>
          <ResponsiveContainer aria-label='Expense breakdown pie chart'>
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
                  const entry = chartData.find((d: any) => d.name === value)
                  const percentage = entry
                    ? Number(entry.value).toFixed(1)
                    : '0.0'
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
                  const { payload } = props || {}
                  const amount = payload?.amount ?? 0
                  const percent = Number(value ?? 0)
                  return [
                    `£${Number(amount).toLocaleString?.() ?? 0} (${percent.toFixed(2)}%)`,
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
