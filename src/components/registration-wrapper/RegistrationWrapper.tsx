import React from 'react'
import { Box } from '@mui/material'
import styles from './RegistrationWrapper.module.scss'
import Footer from './Footer'

interface RegistrationWrapperProps {
  children: React.ReactNode
}

const RegistrationWrapper: React.FC<RegistrationWrapperProps> = ({
  children
}) => {
  return (
    <Box className={styles.pageWrapper}>
      {/* Background section */}
      <Box className={styles.wrapper}>
        <Box className={styles.overlay}>
          <Box className={styles.childrenContainer}>{children}</Box>
        </Box>
      </Box>

      {/* Footer outside background */}
      <Footer />
    </Box>
  )
}

export default RegistrationWrapper
