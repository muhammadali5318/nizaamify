import React from 'react'
import { Box, Typography } from '@mui/material'
import styles from './manualEntryCard.module.scss'

type ManualEntryCardProps = {
  onStart?: () => void
}

const ManualEntryCard: React.FC<ManualEntryCardProps> = () => {
  return (
    <Box className={styles.documentCard}>
      <Box className={styles.leftSection}>
        <Box
          component='img'
          src='/assets/document-upload-card-icon.svg'
          alt='manual entry'
          className={styles.icon}
        />
        <Box>
          <Typography variant='subtitle1' fontWeight={600}>
            Upload documents
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            Upload invoices, payroll, and expense files to keep your KPIs
            accurate and up to date.
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}

export default ManualEntryCard
