import React from 'react'
import { Box, Stack, Typography } from '@mui/material'
import styles from './StatsCard.module.scss'

interface StatsCardProps {
  iconSrc: string
  label: string
  value: string | number
}

const StatsCard: React.FC<StatsCardProps> = ({ iconSrc, label, value }) => {
  return (
    <Box className={styles.statsCardRoot}>
      <Stack className={styles.statsCardDescription}>
        <Box
          component='img'
          src={`/assets/${iconSrc}`}
          alt={`${iconSrc} icon`}
          sx={{ width: 40, height: 40, objectFit: 'contain' }}
        />
        <Typography
          variant='subtitle1'
          fontWeight={700}
          color='var(--color-primary-light)'
        >
          {label}
        </Typography>
      </Stack>
      <Typography
        variant='h3'
        fontWeight={700}
        color='var(--color-primary-light)'
      >
        {value}
      </Typography>
    </Box>
  )
}

export default StatsCard
