import { Box, Stack, Typography } from '@mui/material'
import React from 'react'
import { PieChart, Pie } from 'recharts'
import styles from './chartsStats.module.scss'

const PROGRESS_COLOR = '#20D20D'
const BG_COLOR = '#FFFFFF'

const SIZE = 80
const CENTER_RADIUS = 30
const VERIFICATION_LIMIT = 4

const StatsChart: React.FC<{
  value: number
  total: number
  transactionsWithInvoices: number
  sx?: object
}> = ({ value, transactionsWithInvoices, total, sx }) => {
  const remaining = Math.max(VERIFICATION_LIMIT - transactionsWithInvoices, 0)

  // Dynamic message
  const message =
    transactionsWithInvoices >= VERIFICATION_LIMIT
      ? `You're now a verified Practice. You've uploaded ${transactionsWithInvoices} of ${total} invoice${
          transactionsWithInvoices !== 1 ? 's' : ''
        }`
      : `You've uploaded ${transactionsWithInvoices} of ${total} invoices${
          transactionsWithInvoices !== 1 ? 's' : ''
        }. Upload ${remaining} more to get verified.`

  return (
    <Box className={styles.statsCardRoot} sx={{ ...sx }}>
      <Stack
        className={styles.statsCardDescription}
        alignItems='center'
        justifyContent='center'
      >
        <Box position='relative' width={SIZE} height={SIZE}>
          <PieChart width={SIZE} height={SIZE}>
            {/* Background ring */}
            <Pie
              data={[{ value: 100 }]}
              dataKey='value'
              cx='50%'
              cy='50%'
              innerRadius={CENTER_RADIUS - 2}
              outerRadius={CENTER_RADIUS + 2}
              startAngle={90}
              endAngle={-270}
              fill={BG_COLOR}
              isAnimationActive={false}
            />

            {/* Progress ring */}
            <Pie
              data={[{ value }]}
              dataKey='value'
              cx='50%'
              cy='50%'
              innerRadius={CENTER_RADIUS - 4}
              outerRadius={CENTER_RADIUS + 4}
              startAngle={90}
              endAngle={90 - (value / 100) * 360}
              cornerRadius={4}
              fill={PROGRESS_COLOR}
            />
          </PieChart>

          {/* Center text */}
          <Box
            position='absolute'
            top='50%'
            left='50%'
            sx={{
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              pointerEvents: 'none'
            }}
          >
            <Typography
              variant='body1'
              fontWeight={700}
              lineHeight={1}
              color='success.light'
            >
              {value}%
            </Typography>

            <Typography
              variant='body2'
              fontWeight={700}
              sx={{
                color: '#000',
                lineHeight: 1,
                mt: '2px'
              }}
            >
              Done
            </Typography>
          </Box>
        </Box>
      </Stack>

      <Typography
        variant='subtitle2'
        fontWeight={500}
        fontStyle='italic'
        color='text.primary'
        sx={{ mt: 1 }}
      >
        {message}
      </Typography>
    </Box>
  )
}

export default StatsChart
