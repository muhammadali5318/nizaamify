import React, { useCallback, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Divider,
  Stack,
  Typography,
  SxProps,
  Theme,
  IconButton,
  Menu
} from '@mui/material'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import styles from './PracticeDetailsCard.module.scss'
import ArchivePractice from './ArchivePracticeModal'
import { VerifyIdentityStep } from '../../../components/idetity-verification/VerifyIdentityStep'
import { GetUserReason } from 'src/components/get-user-reason'
import ConfirmationSuccessDialog from 'src/components/team-management/InvitationSuccessDialog'
import { AllPracticesDataObject } from 'src/layouts/applayout/components/PracticeSelector'
import { toTitleCase } from 'src/utils/stringUtils'
import dayjs from 'dayjs'
import { useActivePractice } from 'src/hooks/useActivePractice'
import { useDispatch } from 'react-redux'
import { setMergedPermissionsByCategory } from 'src/store/slices/userDetailsInActivePracticeSlice'
import { ALL_PERMISSIONS } from 'src/const'
import { useFetchAllPracticesData } from 'src/hooks/useFetchAllPracticesData'
import { notify } from 'src/components/notistack/NotificationProvider'

interface PracticeDetailsCardProps {
  status?: 'active' | 'inactive' | 'archived'
  practice: AllPracticesDataObject
}

const PracticeDetailsCard: React.FC<PracticeDetailsCardProps> = ({
  status = 'inactive',
  practice
}) => {
  const dispatch = useDispatch()
  const { setActiveById } = useActivePractice()
  const { data: allPractices } = useFetchAllPracticesData(true)

  const [isArchiveOpen, setIsArchiveOpen] = useState(false)
  const [successDialogOpen, setSuccessDialogOpen] = useState(false)

  const openArchive = useCallback(() => setIsArchiveOpen(true), [])
  const closeArchive = useCallback(() => setIsArchiveOpen(false), [])
  const closeSuccessDialog = useCallback(() => setSuccessDialogOpen(false), [])

  // three-dots dropdown
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const isMenuOpen = Boolean(menuAnchorEl)
  const openMenu = (e: React.MouseEvent<HTMLElement>) =>
    setMenuAnchorEl(e.currentTarget)
  const closeMenu = () => setMenuAnchorEl(null)

  // active chip styles
  const activeChipSx = useMemo<SxProps<Theme>>(
    () => ({
      padding: '4px 2px',
      color: 'white',
      border: 'none',
      backgroundColor: 'var(--color-primary-black)',
      '& .MuiChip-icon': {
        color: 'white'
      }
    }),
    []
  )

  const StatusChip: React.FC<{ sx?: SxProps<Theme> }> = ({ sx }) => {
    if (status === 'active') {
      return (
        <Chip
          size='small'
          label='Active Practice'
          icon={<CheckCircleOutlineIcon />}
          variant='filled'
          sx={{ ...(activeChipSx as object), ...(sx as object) }}
        />
      )
    }

    if (status === 'archived') {
      return (
        <Chip
          size='small'
          label='Practice archived'
          variant='outlined'
          color='warning'
          sx={sx}
        />
      )
    }

    return null
  }

  /** Generic row layout **/
  const InfoRow: React.FC<{ icon: string; children: React.ReactNode }> = ({
    icon,
    children
  }) => (
    <Box className={styles.detailsContainer}>
      <img src={icon} alt='' />
      <Typography variant='body1' color='text.primary'>
        {children}
      </Typography>
    </Box>
  )

  const detailRows = useMemo(
    () => [
      {
        icon: '/assets/location.svg',
        content: practice?.address ?? '-'
      },
      {
        icon: '/assets/suit-case.svg',
        content: practice?.created_at
          ? `Added ${dayjs(practice.created_at).format('DD MMMM YYYY')}`
          : 'Added -'
      },
      {
        icon: '/assets/list.svg',
        content: `${toTitleCase(practice?.accounting_basis ?? '')} basis`
      }
    ],
    [practice]
  )

  const handleSwitchToPractice = useCallback(() => {
    setActiveById(practice?.id, allPractices)
    dispatch(setMergedPermissionsByCategory(ALL_PERMISSIONS))
    notify.success('Switched to ' + practice?.practice_name)
  }, [practice, setActiveById, allPractices, dispatch])

  const archiveSteps = useMemo(
    () => [
      {
        label: 'Verify your identity',
        render: ({ goNext, close }: any) => (
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
        render: ({ goBack, close }: any) => (
          <GetUserReason
            onBack={() => goBack()}
            onArchive={async () => {
              close()
            }}
          />
        )
      }
    ],
    []
  )

  return (
    <Box className={styles.practiceDetailsCardRoot} data-status={status}>
      <ArchivePractice
        open={isArchiveOpen}
        onClose={closeArchive}
        steps={archiveSteps}
      />

      {/* mobile */}
      <StatusChip sx={{ display: { xs: 'flex', sm: 'none' } }} />

      <Box width='100%' display='flex' justifyContent='space-between'>
        <Box width='100%' display='flex' gap={1.5} alignItems='flex-start'>
          <img src='/assets/practice-selector-grey.svg' alt='practice icon' />

          <Box width='100%'>
            <Box width='100%' display='flex' justifyContent='space-between'>
              <Typography variant='subtitle1' fontWeight={700}>
                {practice?.practice_name}
              </Typography>

              <Box display='flex' alignItems='flex-start'>
                {/* desktop status */}
                <StatusChip sx={{ display: { xs: 'none', sm: 'flex' } }} />

                {/* three dots */}
                <IconButton
                  aria-label='more actions'
                  onClick={openMenu}
                  size='small'
                  sx={{
                    padding: '0px'
                  }}
                >
                  <MoreVertIcon />
                </IconButton>

                <Menu
                  anchorEl={menuAnchorEl}
                  open={isMenuOpen}
                  onClose={closeMenu}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                  <Box sx={{ padding: '0px 16px' }}>
                    <Button
                      size='small'
                      variant='outlined'
                      fullWidth
                      color='warning'
                      endIcon={
                        <img
                          src='/assets/archive-only.svg'
                          alt='archive icon'
                        />
                      }
                      onClick={openArchive}
                    >
                      Archive practice
                    </Button>
                  </Box>
                </Menu>
              </Box>
            </Box>

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
      </Box>

      <Divider sx={{ width: '100%', borderColor: 'var(--grey-200)' }} />

      <Stack spacing='10px'>
        {detailRows.map((r, idx) => (
          <InfoRow key={idx} icon={r.icon}>
            {r.content}
          </InfoRow>
        ))}
      </Stack>

      <Divider sx={{ width: '100%', borderColor: 'var(--grey-200)' }} />

      <Stack spacing='10px'>
        <InfoRow icon='/assets/suit-case-checked.svg'>-</InfoRow>
        <Box className={styles.detailsContainer}>
          <Typography
            className='font-style--italic'
            variant='body1'
            color='var(--color-primary-black)'
          >
            Next billing: <strong> -</strong>
          </Typography>
        </Box>
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
          sx={{ visibility: status !== 'active' ? 'visible' : 'hidden' }}
        >
          <Button
            size='small'
            variant='outlined'
            fullWidth
            endIcon={<img src='/assets/switch.svg' alt='switch icon' />}
            onClick={handleSwitchToPractice}
          >
            Switch to this practice
          </Button>
        </Box>
      )}

      <ConfirmationSuccessDialog
        open={successDialogOpen}
        onSubmit={closeSuccessDialog}
        onClose={closeSuccessDialog}
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
          financial insights, and document uploads.
        </Typography>
      </ConfirmationSuccessDialog>
    </Box>
  )
}

export default React.memo(PracticeDetailsCard)
