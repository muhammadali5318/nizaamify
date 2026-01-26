// FILE: SubscriptionType.tsx
import React from 'react'
import { Box, Typography, SxProps, Theme } from '@mui/material'
import styles from './SubscriptionType.module.scss'

export interface SubscriptionTypeProps {
  /** Label text shown inside the pill */
  label?: string
  /** CSS background value (gradient, color, etc.) */
  background?: string
  /** Icon/image src path */
  iconSrc?: string
  /** Image alt text */
  iconAlt?: string
  /** Text color (any valid CSS color) */
  textColor?: string
  /** Optional extra class name to combine with the scoped class */
  className?: string
  /** Additional MUI sx overrides */
  sx?: SxProps<Theme>
}

const defaultBg1 = 'linear-gradient(90deg, #9810FA 0%, #E60076 100%)'

const SubscriptionType: React.FC<SubscriptionTypeProps> = ({
  label = 'Most Popular',
  background = defaultBg1,
  iconSrc = '/assets/transparent-star.svg',
  iconAlt = 'transparent star',
  textColor = '#FFFFFF',
  className,
  sx
}) => {
  // combine module class and optional external className
  const combinedClass = [styles.signupSupscriptionCardType, className]
    .filter(Boolean)
    .join(' ')

  return (
    <Box
      className={combinedClass}
      sx={{
        background,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '2px 6px',
        borderRadius: '999px',
        ...((sx as object) ?? {})
      }}
    >
      <img src={iconSrc} alt={iconAlt} />
      <Typography variant='caption' sx={{ color: textColor }}>
        {label}
      </Typography>
    </Box>
  )
}

export default SubscriptionType
