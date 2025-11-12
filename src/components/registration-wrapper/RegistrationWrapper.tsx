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
      <Box className={styles.wrapper}>
        <Box className={styles.overlay}>
          <Box className={styles.childrenContainer}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: '100vh'
              }}
            >
              {children}
              <Footer />
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

export default RegistrationWrapper
