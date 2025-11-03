// PracticeSettings.tsx
import React, { useState } from 'react'
import { Box, Button, Stack } from '@mui/material'
import styles from './practiceSettings.module.scss'
import PageHeader from 'src/components/page-header'
import PracticeDetailsCard from './components'
import AddPracticeDialog from './components/AddNewPracticeModal'

const PracticeSettings: React.FC = () => {
  const [isAddOpen, setIsAddOpen] = useState(false)

  const handleOpen = () => setIsAddOpen(true)
  const handleClose = () => setIsAddOpen(false)

  return (
    <Stack className={styles.practiceSettingsRoot}>
      <Box className={styles.practiceSettingsHeader}>
        <Box>
          <PageHeader
            title={'Practice Settings'}
            description={'Manage all your dental practices in one place'}
            logo='/assets/team-management.svg'
            isDividerVisible={false}
          />
        </Box>

        <Button
          variant='contained'
          startIcon={
            <img src='/assets/practice-management.svg' alt='practice icon' />
          }
          onClick={handleOpen}
        >
          Add new practice
        </Button>
      </Box>

      <Box className={styles.practiceDetailsWrapper}>
        <PracticeDetailsCard status='active' />
        <PracticeDetailsCard />
        <PracticeDetailsCard />
        <PracticeDetailsCard />
      </Box>

      <PageHeader
        title={'Archived Practices'}
        description={'Manage all your archived dental practices in one place'}
        logo='/assets/archive.svg'
        isDividerVisible={false}
      />

      <Box className={styles.practiceDetailsWrapper}>
        <PracticeDetailsCard status='archived' />
        <PracticeDetailsCard status='archived' />
      </Box>

      {/* Add Practice dialog */}
      <AddPracticeDialog open={isAddOpen} onClose={handleClose} />
    </Stack>
  )
}

export default PracticeSettings
