// src/components/CircularProgressWithLabel.tsx
import React from 'react'
import { Box, CircularProgress, Typography } from '@mui/material'

interface Props {
  value: number // 0 - 100
  size?: number
  thickness?: number
  ariaLabel?: string
}

const CircularProgressWithLabel: React.FC<Props> = ({
  value,
  size = 56,
  thickness,
  ariaLabel = 'progress'
}) => {
  const rounded = Math.round(Math.max(0, Math.min(100, value)))

  return (
    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
      <CircularProgress
        variant='determinate'
        value={rounded}
        size={size}
        {...(thickness ? { thickness } : {})}
        aria-label={ariaLabel}
      />
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Typography variant='caption' component='div' color='text.secondary'>
          {`${rounded}%`}
        </Typography>
      </Box>
    </Box>
  )
}

export default CircularProgressWithLabel
