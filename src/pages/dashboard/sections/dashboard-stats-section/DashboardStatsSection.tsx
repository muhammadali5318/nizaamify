import { useEffect, useState } from 'react'
import { Box, Stack } from '@mui/material'
import { useAuth } from 'src/context/AuthProvider'
import StatsCard from '../../components/DashboardStatsCard'
import { fetchDashboardSummaryKpis } from '../../utils/fetchDashboardSummaryKpis'
import { useActivePractice } from 'src/hooks/useActivePractice'

import revenueIcon from '../../../../assets/revenue-icon.svg'
import costIcon from '../../../../assets/cost-icon.svg'
import profitIcon from '../../../../assets/profit-icon.svg'
import profitPercentage from '../../../../assets/profit-margin-icon.svg'
import ebidtaIcon from '../../../../assets/ebita.svg'
import practiceValueIcon from '../../../../assets/value.svg'

interface DashboardStatsSectionProps {
  selectedPeriod: string
  startDate: string
  endDate: string
}

const DashboardStatsSection = ({
  startDate,
  endDate
}: DashboardStatsSectionProps) => {
  const { accessToken } = useAuth()
  const { activePracticeId } = useActivePractice()
  const [kpiData, setKpiData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      try {
        if (activePracticeId && accessToken) {
          setLoading(true)
          const data = await fetchDashboardSummaryKpis(
            activePracticeId,
            accessToken,
            startDate,
            endDate
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
  }, [activePracticeId, accessToken, startDate, endDate])

  if (!kpiData) return null

  const safeValue = (value: any, prefix = '', suffix = '') =>
    value !== null && value !== undefined && value !== ''
      ? `${prefix}${value}${suffix}`
      : 'N/A'

  const safeTrend = (value: any) =>
    value && !isNaN(parseFloat(value)) ? parseFloat(value) : 'N/A'

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
