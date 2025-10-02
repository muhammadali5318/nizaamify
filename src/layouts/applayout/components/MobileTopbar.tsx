import React from 'react'
import { Box, Typography, useMediaQuery } from '@mui/material'
import styles from './Topbar.module.scss'

type topbarProps = {
  title: string
  icon: string
}

const MobileTopBar: React.FC<topbarProps> = ({ title, icon }) => {
  const isMobile = useMediaQuery('(max-width:600px)')

  if (!isMobile) return null

  return (
    <Box
      className={styles.mobileTopbar}
      sx={{
        pl: {
          xs: '16px',
          sm: '24px',
          md: 0
        },
        position: 'sticky',
        top: '72px',
        zIndex: 1000
      }}
    >
      <Box className={styles.topbarTitleContainer}>
        <img src={`/assets/${icon}`} alt={`${icon} active icon`} />

        <Typography variant='h5' className='font-weight--700'>
          {title}
        </Typography>
      </Box>
    </Box>
  )
}

export default MobileTopBar
