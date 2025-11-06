import React from 'react'
import { Box, Typography, Stack, CircularProgress } from '@mui/material'
import { TrendingDown, TrendingUp } from '@mui/icons-material'

interface StatsCardProps {
  title: string
  value: string | number
  icon?: React.ReactNode
  trend?: any
  trendColor?: string
  subtitle?: string
  backgroundColor?: string
  loading?: boolean
  type?: string
}

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon,
  trend,
  trendColor,
  subtitle,
  backgroundColor = '#FAFAFA',
  loading = false,
  type = 'default'
}) => {
  if (trend === 'N/A' || trend === null || trend === undefined) trend = null

  const isPositive = trend && trend > 0
  const isNegative = trend && trend < 0

  let displayIcon = null
  let displayColor = 'text.secondary'

  if (type === 'revenue') {
    if (isPositive) {
      displayIcon = <TrendingUp sx={{ color: '#2e7d32', fontSize: 20 }} />
      displayColor = '#2e7d32'
    } else if (isNegative) {
      displayIcon = <TrendingDown sx={{ color: '#d32f2f', fontSize: 20 }} />
      displayColor = '#d32f2f'
    }
  } else if (type === 'cost') {
    if (isPositive) {
      displayIcon = <TrendingUp sx={{ color: '#d32f2f', fontSize: 20 }} />
      displayColor = '#d32f2f'
    } else if (isNegative) {
      displayIcon = <TrendingDown sx={{ color: '#2e7d32', fontSize: 20 }} />
      displayColor = '#2e7d32'
    }
  } else {
    if (isPositive) {
      displayIcon = <TrendingUp sx={{ color: '#2e7d32', fontSize: 20 }} />
      displayColor = '#2e7d32'
    } else if (isNegative) {
      displayIcon = <TrendingDown sx={{ color: '#d32f2f', fontSize: 20 }} />
      displayColor = '#d32f2f'
    }
  }

  return (
    <Box
      sx={{
        backgroundColor,
        borderRadius: '12px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
        padding: '16px 20px',
        minWidth: '15%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        maxHeight: 140
      }}
    >
      <Stack direction='row' alignItems='center' spacing={1}>
        {icon && (
          <Box
            sx={{
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              backgroundColor: 'rgba(0,0,0,0.05)'
            }}
          >
            {icon}
          </Box>
        )}
      </Stack>

      <Box mt={1}>
        <Typography variant='body2' color='text.secondary'>
          {title}
          {subtitle && (
            <Typography variant='caption' color='text.disabled' ml={0.5}>
              {subtitle}
            </Typography>
          )}
        </Typography>
      </Box>

      <Box
        mt={0}
        display='flex'
        alignItems='center'
        justifyContent='flex-start'
      >
        {loading ? (
          <CircularProgress size={28} thickness={4} sx={{ color: '#000' }} />
        ) : (
          <>
            <Typography variant='h6' fontWeight={600}>
              {value}
            </Typography>

            {trend !== null && (
              <Stack direction='row' alignItems='center' spacing={0.3} ml={1}>
                {displayIcon}
                <Typography
                  variant='body2'
                  sx={{
                    color: trendColor || displayColor,
                    fontWeight: 500
                  }}
                >
                  {trend !== 'N/A' ? `${Math.abs(trend)}%` : 'N/A'}
                </Typography>
              </Stack>
            )}
          </>
        )}
      </Box>
    </Box>
  )
}

export default StatsCard
