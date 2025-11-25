import { Box, Stack, Typography } from '@mui/material'
import styles from './warningAlertWrapper.module.scss'
import React from 'react'

type WarningAlertWrapperProps = {
  children: React.ReactNode
}

const WarningAlertWrapper: React.FC<WarningAlertWrapperProps> = ({
  children
}) => {
  return (
    <Box className={styles.warningAlertBannerRoot}>
      <Box display={'flex'} gap={'10px'} alignItems={'center'}>
        <img
          className='icon-dimension--32'
          src='/assets/warning.svg'
          alt='warning icon'
        />
        <Typography color='warning.dark' variant='h6' fontWeight={700}>
          Needs attention
        </Typography>
      </Box>

      <Stack spacing={'6px'} width={'100%'}>
        {children}
      </Stack>
    </Box>
  )
}

export default WarningAlertWrapper
