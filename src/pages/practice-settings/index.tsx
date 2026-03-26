import React, { useState } from 'react'
import { Box, Button, Stack } from '@mui/material'
import styles from './practiceSettings.module.scss'
import PageHeader from 'src/components/page-header'
import PracticeDetailsCard from './components'
import { useAuth } from 'src/context/AuthProvider'
import { useFetchAllPracticesData } from 'src/hooks/useFetchAllPracticesData'
import { AllPracticesDataObject } from 'src/store/slices/activePracticeSlice'
import { useActivePractice } from 'src/hooks/useActivePractice'
import AddPracticeModal from './components/AddPracticeModal'
import useUserDetails from 'src/hooks/useUserDetails'
import { useFetchUserWithActivePracticeData } from 'src/hooks/useFetchUserWithActivePracticeData'

const PracticeSettings: React.FC = () => {
  const { isOwnerOrDirectorInAnyPractice } = useUserDetails()
  const { activePracticeId } = useActivePractice()
  const { accessToken } = useAuth()
  const { data: practicesList } = useFetchAllPracticesData(!!accessToken)
  const { data: userDetailsInPractice } =
    useFetchUserWithActivePracticeData(!!accessToken)
  const [isAddOpen, setIsAddOpen] = useState(false)

  const userPracticeMap = Object.fromEntries(
    userDetailsInPractice?.active_practices?.map((p: any) => [
      p.practice_id,
      p.user_role
    ]) || []
  )

  const updatedPracticeList =
    practicesList?.map((p: AllPracticesDataObject) => ({
      ...p,
      user_role: userPracticeMap[p.id] || null
    })) || []

  const unarchivedPractices = updatedPracticeList?.filter(
    (practice: AllPracticesDataObject) => practice.status !== 'ARCHIVED'
  )
  const archivedPractices = updatedPracticeList?.filter(
    (practice: AllPracticesDataObject) => practice.status === 'ARCHIVED'
  )

  const handleOpen = () => setIsAddOpen(true)
  const handleClose = () => setIsAddOpen(false)

  return (
    <Stack className={styles.practiceSettingsRoot}>
      <Box className={styles.practiceSettingsHeader}>
        <PageHeader
          title='Practice Settings'
          description='Manage all your dental practices in one place'
          logo='/assets/team-management.svg'
          isDividerVisible={false}
        />

        {isOwnerOrDirectorInAnyPractice && (
          <Button
            className={styles.noWrapButton}
            variant='contained'
            startIcon={
              <img src='/assets/practice-management.svg' alt='practice icon' />
            }
            onClick={handleOpen}
          >
            Add new practice
          </Button>
        )}
      </Box>

      {/* Practice cards */}
      <Box className={styles.practiceDetailsWrapper}>
        {unarchivedPractices.map((practice: AllPracticesDataObject) => (
          <PracticeDetailsCard
            key={practice.id}
            status={practice.id === activePracticeId ? 'active' : 'inactive'}
            practice={practice}
            unarchivedPractices={unarchivedPractices}
            practicesListLength={unarchivedPractices?.length}
          />
        ))}
      </Box>

      {archivedPractices?.length > 0 && (
        <PageHeader
          title={'Archived Practices'}
          description={'Manage all your archived dental practices in one place'}
          logo='/assets/archive.svg'
          isDividerVisible={false}
        />
      )}

      <Box className={styles.practiceDetailsWrapper}>
        {archivedPractices?.map((practice: AllPracticesDataObject) => (
          <PracticeDetailsCard
            key={practice.id}
            status={practice?.status === 'ARCHIVED' ? 'archived' : 'inactive'}
            practice={practice}
            practicesListLength={archivedPractices?.length}
          />
        ))}
      </Box>

      {/* Add Practice dialog */}
      <AddPracticeModal open={isAddOpen} onClose={handleClose} />
    </Stack>
  )
}

export default PracticeSettings
