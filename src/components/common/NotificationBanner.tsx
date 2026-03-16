import React from 'react'
import { Box, Typography } from '@mui/material'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'

interface NotificationBannerProps {
  content: string
  backgroundColor?: string
  borderColor?: string
  iconColor?: string
  textColor?: string
}

const NotificationBanner: React.FC<NotificationBannerProps> = ({
  content,
  backgroundColor = '#E3F2FD',
  borderColor = '#B3E5FC',
  iconColor = '#0288D1',
  textColor = '#01579B'
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: '8px',
        backgroundColor,
        borderRadius: '8px',
        padding: '8px 12px',
        border: `1px solid ${borderColor}`,
        mb: 2,
        textAlign: 'left'
      }}
    >
      <Box sx={{ paddingTop: '4px', color: iconColor }}>
        <ErrorOutlineIcon />
      </Box>

      <Typography
        variant='body2'
        fontSize={{ xs: 13, md: 15 }}
        sx={{ color: textColor }}
      >
        {content}
      </Typography>
    </Box>
  )
}

export default NotificationBanner
