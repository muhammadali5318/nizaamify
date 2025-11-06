// PracticeSettings.tsx
import React, { useState } from 'react'
import { Box, Button, Stack } from '@mui/material'
import styles from './practiceSettings.module.scss'
import PageHeader from 'src/components/page-header'
import PracticeDetailsCard from './components'
import AddPracticeDialog from './components/AddNewPracticeModal'
import { useAuth } from 'src/context/AuthProvider'
import { useFetchAllPracticesData } from 'src/hooks/useFetchAllPracticesData'
import { AllPracticesDataObject } from 'src/layouts/applayout/components/PracticeSelector'
import { useActivePractice } from 'src/hooks/useActivePractice'

const PracticeSettings: React.FC = () => {
  const { activePracticeId } = useActivePractice()
  const { accessToken } = useAuth()
  const { data: practicesList } = useFetchAllPracticesData(!!accessToken)
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
        {practicesList?.map((practice: AllPracticesDataObject) => (
          <PracticeDetailsCard
            key={practice.id}
            status={practice.id === activePracticeId ? 'active' : 'inactive'}
            practice={practice}
          />
        ))}
      </Box>

      {/* <PageHeader
        title={'Archived Practices'}
        description={'Manage all your archived dental practices in one place'}
        logo='/assets/archive.svg'
        isDividerVisible={false}
      />

      <Box className={styles.practiceDetailsWrapper}>
        <PracticeDetailsCard status='archived' />
        <PracticeDetailsCard status='archived' />
      </Box> */}

      {/* Add Practice dialog */}
      <AddPracticeDialog open={isAddOpen} onClose={handleClose} />
    </Stack>
  )
}

export default PracticeSettings
