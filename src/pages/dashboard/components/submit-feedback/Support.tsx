import React from 'react'
import { Stack } from '@mui/material'
import ModuleHeader from 'src/components/module-header'
import styles from './submitFeedback.module.scss'

export interface SupportProps {
  avatarSrc: string
  heading: string
  subheading?: string
  children?: React.ReactNode
}

const Support: React.FC<SupportProps> = ({
  avatarSrc,
  heading,
  subheading,
  children
}) => {
  return (
    <Stack
      spacing='14px'
      sx={{
        flex: 1,
        width: { xs: '100%', sm: '100%' },
        boxSizing: 'border-box'
      }}
      className={styles.supportRoot}
    >
      <ModuleHeader
        avatarSrc={avatarSrc}
        heading={heading}
        subheading={subheading}
        subheadingVariant={'subtitle2'}
        gap={0}
      />

      {children}
    </Stack>
  )
}

export default Support
