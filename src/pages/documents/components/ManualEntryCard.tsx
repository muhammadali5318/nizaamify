import React from 'react'
import { Box, Typography, Button } from '@mui/material'
import styles from './manualEntryCard.module.scss'

type ManualEntryCardProps = {
  onClick?: () => void
}

const ManualEntryCard: React.FC<ManualEntryCardProps> = ({ onClick }) => {
  return (
    <Box className={styles.manualEntryCard}>
      <Box className={styles.leftSection}>
        <Box
          component='img'
          src='/assets/manual-upload.svg'
          alt='manual entry'
          className={styles.icon}
        />
        <Box>
          <Typography variant='subtitle1' fontWeight={600}>
            Enter data manually
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            No documents? You can add your practice data directly by filling in
            the required fields.
          </Typography>
        </Box>
      </Box>
      <Button
        variant='contained'
        className={styles.actionBtn}
        onClick={onClick}
      >
        Start manual entry
      </Button>
    </Box>
  )
}

export default ManualEntryCard
