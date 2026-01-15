import { Box, Stack, Typography } from '@mui/material'
import React from 'react'
import { PieChart, Pie } from 'recharts'
import styles from './chartsStats.module.scss'

const PROGRESS_COLOR = '#20D20D'
const BG_COLOR = '#FFFFFF'

const SIZE = 80
const CENTER_RADIUS = 30

const StatsChart: React.FC<{ value: number; sx?: object }> = ({
  value,
  sx
}) => {
  return (
    <Box className={styles.statsCardRoot} sx={{ ...sx }}>
      <Stack
        className={styles.statsCardDescription}
        alignItems='center'
        justifyContent='center'
      >
        <Box position='relative' width={SIZE} height={SIZE}>
          <PieChart width={SIZE} height={SIZE}>
            {/* Background ring (thin, centered) */}
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

            {/* Progress ring (thicker, centered) */}
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
      >
        You&apos;ve uploaded 2 of 7 invoices ({value}%). Upload 4 more to get
        verified.
      </Typography>
    </Box>
  )
}

export default StatsChart
