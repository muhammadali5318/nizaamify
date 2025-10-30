import React from 'react'
import { Box, Typography } from '@mui/material'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'

interface NotificationBannerProps {
  content: string
}

const NotificationBanner: React.FC<NotificationBannerProps> = ({ content }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: '8px',
        backgroundColor: '#E3F2FD',
        borderRadius: '8px',
        padding: '8px 12px',
        border: '1px solid #B3E5FC',
        mb: 2,
        textAlign: 'left'
      }}
    >
      <Box sx={{ paddingTop: '4px', color: '#0288D1' }}>
        <ErrorOutlineIcon />
      </Box>
      <Typography
        variant='body2'
        fontSize={{ xs: 13, md: 15 }}
        sx={{ color: '#01579B' }}
      >
        {content}
      </Typography>
    </Box>
  )
}

export default NotificationBanner
