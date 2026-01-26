// src/components/common/WarningBanner.tsx
import React from 'react'
import { Box, Typography } from '@mui/material'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import styles from './PendingOnboardingBanner.module.scss' // reuse existing css module

export type WarningBannerProps = {
  icon?: React.ReactNode
  message: React.ReactNode
  actions?: React.ReactNode // pass <Button />s or any nodes
  rootClassName?: string
  headerClassName?: string
  actionClassName?: string
}

const WarningBanner: React.FC<WarningBannerProps> = ({
  icon,
  message,
  actions,
  rootClassName,
  headerClassName,
  actionClassName
}) => {
  return (
    <Box
      className={`${styles.pendingOnboardingBannerRoot} ${rootClassName || ''}`}
    >
      <Box
        className={`${styles.pendingOnboardingBannerHeader} ${headerClassName || ''}`}
      >
        {icon ?? <ErrorOutlineIcon color='warning' />}
        <Typography variant='subtitle1' color='var(--color-warning-dark)'>
          {message}
        </Typography>
      </Box>

      {actions ? (
        <Box
          className={`${styles.pendingOnboardingBannerAction} ${actionClassName || ''}`}
        >
          {/*
            Expect callers to pass Buttons (or any nodes). This keeps the Banner flexible:
            caller controls click handlers, navigation, dialog toggles, etc.
          */}
          {actions}
        </Box>
      ) : null}
    </Box>
  )
}

export default WarningBanner
