import React from 'react'
import { Box } from '@mui/material'
import styles from './RegistrationWrapper.module.scss'

interface RegistrationWrapperProps {
  children: React.ReactNode
}

const RegistrationWrapper: React.FC<RegistrationWrapperProps> = ({
  children
}) => {
  return (
    <Box className={styles.pageWrapper}>
      <Box className={styles.wrapper}>
        <Box className={styles.overlay}>
          <Box className={styles.childrenContainer}>{children}</Box>
        </Box>
      </Box>
    </Box>
  )
}

export default RegistrationWrapper
