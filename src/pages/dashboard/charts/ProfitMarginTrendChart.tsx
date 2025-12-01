import { useEffect, useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress
} from '@mui/material'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import profitIcon from '../../../assets/profit-margin-dash-icon.svg'
import { getOperatingProfitTrend } from '../utils/useOperatingProfitTrend'

interface Props {
  practiceId: any
  granularity: string
  year: number
  month: any
}

const ProfitMarginTrendChart = ({
  granularity,
  month,
  year,
  practiceId
}: Props) => {
  const [chartData, setChartData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!practiceId) return

    const fetchTrend = async () => {
      try {
        setLoading(true)
        setError(null)

        const data = await getOperatingProfitTrend({
          practiceId,
          granularity,
          year,
          month
        })

        const formatted =
          data?.series?.map((item: any) => ({
            label: item.label,
            margin: Number(item.total_operating_profit)
          })) || []

        setChartData(formatted)
      } catch (err: any) {
        setError('Failed to load profit margin trend')
      } finally {
        setLoading(false)
      }
    }

    fetchTrend()
  }, [practiceId, granularity, month, year])

  return (
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

        {/* Loader */}
        {loading && (
          <Box
            display='flex'
            justifyContent='center'
            alignItems='center'
            height={250}
          >
            <CircularProgress />
          </Box>
        )}

        {/* Error */}
        {error && (
          <Typography color='error' textAlign='center' height={250}>
            {error}
          </Typography>
        )}

        {/* Chart */}
        {!loading && !error && (
          <ResponsiveContainer width='100%' height={250}>
            <LineChart data={chartData}>
              <XAxis dataKey='label' />
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
        )}
      </CardContent>
    </Card>
  )
}

export default ProfitMarginTrendChart
