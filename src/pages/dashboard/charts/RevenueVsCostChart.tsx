import { useEffect, useState } from 'react'
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
import { getRevenueCostTrend } from '../utils/getRevenueVsCostTrend'

const RevenueVsCostChart = ({
  practiceId,
  granularity,
  year,
  month
}: {
  practiceId: any
  granularity: string
  year: number
  month: any
}) => {
  const [chartData, setChartData] = useState([])

  useEffect(() => {
    if (!practiceId) return

    const fetchData = async () => {
      try {
        const response = await getRevenueCostTrend({
          practiceId,
          granularity: granularity,
          year: year,
          month: month
        })

        const formatted = response.series.map((item: any) => ({
          name: item.label,
          Revenue: Number(item.revenue),
          Cost: Number(item.costs)
        }))

        setChartData(formatted)
      } catch (error) {
        console.error(error)
      }
    }

    fetchData()
  }, [practiceId, granularity, month, year])

  return (
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
          <BarChart data={chartData}>
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
              fill='#b0b0b0'
              radius={[12, 12, 0, 0]}
              barSize={12.5}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export default RevenueVsCostChart
