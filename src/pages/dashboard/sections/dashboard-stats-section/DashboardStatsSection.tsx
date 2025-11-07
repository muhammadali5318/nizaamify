import { useEffect, useState } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import { useAuth0 } from '@auth0/auth0-react'
import { useAuth } from 'src/context/AuthProvider'
import StatsCard from '../../components/DashboardStatsCard'
import { fetchDashboardSummaryKpis } from '../../utils/fetchDashboardSummaryKpis'

import revenueIcon from '../../../../assets/revenue-icon.svg'
import costIcon from '../../../../assets/cost-icon.svg'
import profitIcon from '../../../../assets/profit-icon.svg'
import profitPercentage from '../../../../assets/profit-margin-icon.svg'
import ebidtaIcon from '../../../../assets/ebita.svg'
import practiceValueIcon from '../../../../assets/value.svg'
import PeriodSelector from '../../components/PeriodSelector'
import dayjs from 'dayjs'

const DashboardStatsSection = () => {
  const { user } = useAuth0()
  const { accessToken } = useAuth()

  const [kpiData, setKpiData] = useState<any>(null)
  const [selectedPeriod, setSelectedPeriod] = useState('Current month')
  const [loading, setLoading] = useState(false)
  const practiceId = user?.organizations_with_roles[0]?.metadata?.uuid

  const getDateRange = (label: string) => {
    const endDate = dayjs()
    let startDate

    switch (label) {
      case 'Current month':
        startDate = endDate.startOf('month')
        break
      case '3-month view':
        startDate = endDate.subtract(3, 'month')
        break
      case 'Yearly':
        startDate = endDate.subtract(12, 'month')
        break
      default:
        startDate = endDate.startOf('month')
    }

    return {
      start_date: startDate.format('YYYY-MM-DD'),
      end_date: endDate.format('YYYY-MM-DD')
    }
  }

  useEffect(() => {
    const loadData = async () => {
      try {
        if (practiceId && accessToken) {
          setLoading(true)

          const { start_date, end_date } = getDateRange(selectedPeriod)
          const data = await fetchDashboardSummaryKpis(
            practiceId,
            accessToken,
            start_date,
            end_date
          )
          setKpiData(data)
        }
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [practiceId, accessToken, selectedPeriod])

  if (!kpiData) return null

  const safeValue = (value: any, prefix = '', suffix = '') =>
    value !== null && value !== undefined && value !== ''
      ? `${prefix}${value}${suffix}`
      : 'N/A'

  const safeTrend = (value: any) => {
    if (
      value === null ||
      value === undefined ||
      value === '' ||
      isNaN(parseFloat(value))
    ) {
      return 'N/A'
    }
    return parseFloat(value)
  }

  const stats = [
    {
      title: 'Revenue',
      subtitle: '(This period)',
      value: safeValue(kpiData.revenue, '£'),
      trend: safeTrend(kpiData.revenue_change_percent),
      icon: <img src={revenueIcon} alt='revenue' />,
      type: 'revenue'
    },
    {
      title: 'Cost',
      subtitle: '(This period)',
      value: safeValue(kpiData.costs, '£'),
      trend: safeTrend(kpiData.costs_change_percent),
      icon: <img src={costIcon} alt='cost' />,
      type: 'cost'
    },
    {
      title: 'Operating Profit',
      value: safeValue(kpiData.operating_profit, '£'),
      icon: <img src={profitIcon} alt='profit' />
    },
    {
      title: 'Profit Margin',
      value: safeValue(kpiData.operating_profit_margin_percentage, '', '%'),
      icon: <img src={profitPercentage} alt='profit margin' />
    },
    {
      title: 'EBITDA',
      value: safeValue(kpiData.ebidta, '£'),
      icon: <img src={ebidtaIcon} alt='ebidta' />
    },
    {
      title: 'Practice Value',
      value: safeValue(kpiData.practice_value, '£'),
      icon: <img src={practiceValueIcon} alt='practice value' />
    }
  ]

  return (
    <Box>
      <Box
        mb={2}
        sx={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between'
        }}
      >
        <Box>
          <Typography variant='h6' fontWeight={600}>
            Practice Financial Overview
          </Typography>
        </Box>
        <Box>
          <PeriodSelector
            options={['Current month', '3-month view', 'Yearly']}
            selected={selectedPeriod}
            onSelect={setSelectedPeriod}
          />
        </Box>
      </Box>

      <Stack
        direction={{ xs: 'column', sm: 'column', md: 'row', lg: 'row' }}
        spacing={2}
        flexWrap='nowrap'
        justifyContent='space-between'
      >
        {stats.map((stat, index) => (
          <StatsCard key={index} {...stat} loading={loading} />
        ))}
      </Stack>
    </Box>
  )
}

export default DashboardStatsSection
