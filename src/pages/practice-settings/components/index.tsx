import React, { useCallback, useState } from 'react'
import { Box, Button, Chip, Divider, Stack, Typography } from '@mui/material'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import styles from './PracticeDetailsCard.module.scss'
import ArchivePractice from './ArchivePracticeModal'
import { VerifyIdentityStep } from '../../../components/idetity-verification/VerifyIdentityStep'
import { GetUserReason } from 'src/components/get-user-reason'
import ConfirmationSuccessDialog from 'src/components/team-management/InvitationSuccessDialog'
import { AllPracticesDataObject } from 'src/layouts/applayout/components/PracticeSelector'
import { toTitleCase } from 'src/utils/stringUtils'
import dayjs from 'dayjs'
import { useActivePractice } from 'src/hooks/useActivePractice'

interface PracticeDetailsCardProps {
  status?: 'active' | 'inactive' | 'archived'
  practice: AllPracticesDataObject
}

const PracticeDetailsCard: React.FC<PracticeDetailsCardProps> = ({
  status = 'inactive',
  practice
}) => {
  const { setActivePractice } = useActivePractice()
  const [isArchiveOpen, setIsArchiveOpen] = useState<boolean>(false)
  const [successDialogOpen, setSuccessDialogOpen] = useState(false)

  const openArchive = () => setIsArchiveOpen(true)
  const closeArchive = () => setIsArchiveOpen(false)

  const handleCloseSuccessDialog = useCallback(() => {
    setSuccessDialogOpen(false)
  }, [])
  const activeChipSx = {
    padding: '4px 2px',
    color: 'white',
    border: 'none',
    backgroundColor: 'var(--color-primary-black)',
    '& .MuiChip-icon': {
      color: 'white'
    }
  }

  return (
    <Box className={styles.practiceDetailsCardRoot} data-status={status}>
      <ArchivePractice
        open={isArchiveOpen}
        onClose={closeArchive}
        steps={[
          {
            label: 'Verify your identity',
            render: ({ goNext, close }) => (
              <VerifyIdentityStep
                onCancel={() => close()}
                onNext={() => {
                  goNext()
                }}
              />
            )
          },
          {
            label: 'Reason for archiving',
            render: ({ goBack, close }) => (
              <GetUserReason
                onBack={() => goBack()}
                onArchive={async () => {
                  close()
                }}
              />
            )
          }
        ]}
      />

      {/* mobile-only: show when width <= 600px */}
      {status === 'active' && (
        <Chip
          size='small'
          label='Active Practice'
          icon={<CheckCircleOutlineIcon />}
          variant='filled'
          sx={{
            ...activeChipSx,
            display: { xs: 'flex', sm: 'none' } // show on xs, hide on sm+
          }}
        />
      )}

      {/* mobile-only: show when width <= 600px */}
      {status === 'archived' && (
        <Chip
          size='small'
          label='Practice archived'
          variant='outlined'
          color='warning'
          sx={{
            display: { xs: 'flex', sm: 'none' } // show on xs, hide on sm+
          }}
        />
      )}

      <Box width={'100%'} display={'flex'} justifyContent={'space-between'}>
        <Box display={'flex'} gap={1.5} alignItems='center'>
          <img src='/assets/practice-selector-grey.svg' alt='practice icon' />

          <Box>
            <Typography variant='subtitle1' fontWeight={700}>
              {practice?.practice_name}
            </Typography>

            <Chip
              size='small'
              label={
                practice?.onboarding_status !== 'COMPLETED'
                  ? 'Practice onboarding pending'
                  : toTitleCase(practice?.practice_type ?? '')
              }
              sx={{
                padding: '4px 10px',
                bgcolor:
                  practice?.onboarding_status !== 'COMPLETED'
                    ? 'rgba(211, 47, 47, 0.15)'
                    : 'rgba(76, 175, 80, 0.15)',
                color:
                  practice?.onboarding_status !== 'COMPLETED'
                    ? 'error.main'
                    : 'success.main',
                border: 'none'
              }}
            />
          </Box>
        </Box>

        {status === 'active' && (
          <Chip
            size='small'
            label='Active Practice'
            icon={<CheckCircleOutlineIcon />}
            variant='filled'
            sx={{
              ...activeChipSx,
              display: { xs: 'none', sm: 'flex' }
            }}
          />
        )}

        {status === 'archived' && (
          <Chip
            size='small'
            label='Practice archived'
            variant='outlined'
            color='warning'
            sx={{
              display: { xs: 'none', sm: 'flex' }
            }}
          />
        )}
      </Box>

      <Divider sx={{ width: '100%', borderColor: 'var(--grey-200)' }} />
      <Stack spacing={'10px'}>
        <Box className={styles.detailsContainer}>
          <img src='/assets/location.svg' alt='location' />
          <Typography variant='body1' color='text.primary'>
            {practice?.address}
          </Typography>
        </Box>
        <Box className={styles.detailsContainer}>
          <img src='/assets/suit-case.svg' alt='suit-case' />
          <Typography variant='body1' color='text.primary'>
            Added {dayjs(practice?.created_at)?.format('DD MMMM YYYY')}
          </Typography>
        </Box>
        <Box className={styles.detailsContainer}>
          <img src='/assets/list.svg' alt='list icon' />
          <Typography variant='body1' color='text.primary'>
            {toTitleCase(practice?.accounting_basis ?? '')} basis
          </Typography>
        </Box>
      </Stack>
      <Divider sx={{ width: '100%', borderColor: 'var(--grey-200)' }} />
      <Stack spacing={'10px'}>
        <Box className={styles.detailsContainer}>
          <img
            src='/assets/suit-case-checked.svg'
            alt='suit-case-checked icon'
          />
          <Typography variant='body1' color='text.primary'>
            -
          </Typography>
        </Box>

        {/* <Box className={styles.detailsContainer}>
          <Typography
            className='font-style--italic'
            variant='body1'
            color='var(--color-primary-black)'
          >
            Next billing: <strong> -</strong>
          </Typography>
        </Box> */}
      </Stack>

      {status === 'archived' ? (
        <Box className={styles.detailsCardActionContainer}>
          <Button
            size='small'
            variant='outlined'
            fullWidth
            color='warning'
            onClick={() => setSuccessDialogOpen(true)}
            endIcon={<img src='/assets/archive-only.svg' alt='archive icon' />}
          >
            Unarchive practice
          </Button>
        </Box>
      ) : (
        <Box
          className={styles.detailsCardActionContainer}
          sx={{
            visibility: status !== 'active' ? 'visible' : 'hidden'
          }}
        >
          <Button
            size='small'
            variant='outlined'
            fullWidth
            color='warning'
            endIcon={<img src='/assets/archive-only.svg' alt='archive icon' />}
            onClick={openArchive}
          >
            Archive practice
          </Button>
          <Button
            size='small'
            variant='outlined'
            fullWidth
            endIcon={<img src='/assets/switch.svg' alt='switch icon' />}
            onClick={() => setActivePractice(practice)}
          >
            Switch to this practice
          </Button>
        </Box>
      )}

      <ConfirmationSuccessDialog
        open={successDialogOpen}
        onSubmit={handleCloseSuccessDialog}
        onClose={handleCloseSuccessDialog}
        buttonTitle='Go to practice dashboard'
        title='Practice Successfully Rearchived'
        titleVariant={'h5'}
        showCancelBtn={true}
      >
        <Typography variant='subtitle1' color='text.primary'>
          Your practice has been unarchived and is now active again.
        </Typography>

        <Typography variant='subtitle1' color='text.primary'>
          You and your team can resume normal access to all dashboards,
          financial insights, and document uploads.{' '}
        </Typography>
      </ConfirmationSuccessDialog>
    </Box>
  )
}

export default PracticeDetailsCard
