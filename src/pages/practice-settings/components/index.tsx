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
import { toTitleCase } from 'src/utils/stringUtils'
import dayjs from 'dayjs'
import { useActivePractice } from 'src/hooks/useActivePractice'
import { useDispatch } from 'react-redux'
import { setMergedPermissionsByCategory } from 'src/store/slices/userDetailsInActivePracticeSlice'
import { ALL_PERMISSIONS } from 'src/const'
import { useFetchAllPracticesData } from 'src/hooks/useFetchAllPracticesData'
import { clearAll } from 'src/store/slices/processedBatchDataSlice'
import { clearFiles } from 'src/store/slices/uploadSlice'
import { clearPresignData } from 'src/store/slices/presignedSlice'
import { clearProcessing } from 'src/store/slices/processingSlice'
import { AllPracticesDataObject } from 'src/store/slices/activePracticeSlice'
import { clearProcessing as clearBankStatementProcessing } from 'src/store/slices/bankstatementProcessingSlice'
import { clearAllBankStatements } from 'src/store/slices/bankStatementUploadSlice'
import { clearPresignStatementsData } from 'src/store/slices/presignedBankstatementsSlice'
import { clearAll as clearAllProcessedBankStatements } from 'src/store/slices/processedBankStatementBatchDataSlice'
import {
  setConnectionId,
  setStatus
} from 'src/store/slices/bankConnectionSlice'
import { clearChatStorage } from 'src/store/slices/chatSlice'
import { resetPresignResponse } from 'src/store/slices/manualEntryFilesSlice'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import useUserDetails from 'src/hooks/useUserDetails'
import { queryClient } from 'src/utils/queryClient'
import { useLogout } from 'src/hooks/useLogout'
import { useAuth0 } from '@auth0/auth0-react'
import { useNavigate } from 'react-router'
import { paths } from 'src/paths'
import { notify } from 'src/components/notistack/NotificationProvider'

interface PracticeDetailsCardProps {
  status?: 'active' | 'inactive' | 'archived'
  practice: AllPracticesDataObject
  unarchivedPractices?: AllPracticesDataObject[]
  practicesListLength: number
}

const PracticeDetailsCard: React.FC<PracticeDetailsCardProps> = ({
  status = 'inactive',
  practice,
  practicesListLength,
  unarchivedPractices
}) => {
  const { handleLogout } = useLogout()

  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { setActiveById } = useActivePractice()
  const { data: allPractices } = useFetchAllPracticesData(true)
  const { activePracticeId } = useActivePractice()
  const { userId, email } = useUserDetails()
  const { getAccessTokenSilently } = useAuth0()
  const [isUnarchiving, setIsUnarchiving] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)

  const [isArchiveOpen, setIsArchiveOpen] = useState(false)
  const [successDialogOpen, setSuccessDialogOpen] = useState(false)

  const openArchive = useCallback(() => setIsArchiveOpen(true), [])
  const closeArchive = useCallback(() => setIsArchiveOpen(false), [])

  const closeSuccessDialog = useCallback(async () => {
    try {
      await queryClient.invalidateQueries({
        queryKey: ['listAllPracticesData']
      })
      const token = await getAccessTokenSilently({
        cacheMode: 'off'
      })
      apiClient.defaults.headers.common.Authorization = `Bearer ${token}`
    } catch (error) {
      console.error('Failed to invalidate queries:', error)
    } finally {
      setSuccessDialogOpen(false)
    }
  }, [])

  const submitSuccessDialog = useCallback(async () => {
    try {
      await queryClient.invalidateQueries({
        queryKey: ['listAllPracticesData']
      })

      const token = await getAccessTokenSilently({
        cacheMode: 'off'
      })
      apiClient.defaults.headers.common.Authorization = `Bearer ${token}`
      handleSwitchToPractice(practice?.id)
      navigate(paths.dashboard)
    } catch (error) {
      console.error('Failed to invalidate queries:', error)
    } finally {
      setSuccessDialogOpen(false)
    }
  }, [])

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

  const handleSwitchToPractice = useCallback(
    (practiceId: string) => {
      setActiveById(practiceId, allPractices)
      dispatch(setMergedPermissionsByCategory(ALL_PERMISSIONS))
      dispatch(clearAll())
      dispatch(clearProcessing())
      dispatch(clearFiles())
      dispatch(clearPresignData())
      localStorage.removeItem('bank_connection_id')
      dispatch(setStatus(null))
      dispatch(setConnectionId(null))
      dispatch(clearChatStorage())
      dispatch(clearAllProcessedBankStatements())
      dispatch(clearAllBankStatements())
      dispatch(clearBankStatementProcessing())
      dispatch(clearPresignStatementsData())

      // remove mannual entries
      dispatch(resetPresignResponse())
    },
    [practice, setActiveById, allPractices, dispatch]
  )

  const handleUnarchive = async () => {
    if (!userId || !practice?.id) return

    setIsUnarchiving(true)

    try {
      await apiClient.put(endpoints.unarchivePractice(userId, practice.id), {
        action: 'UNARCHIVE'
      })

      notify.success('Practice unarchived successfully')
      setSuccessDialogOpen(true)
    } catch (error) {
      console.error('Failed to unarchive practice:', error)
    } finally {
      setIsUnarchiving(false)
    }
  }

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
            onArchive={async (reason) => {
              if (!userId || !practice?.id) return

              setIsArchiving(true)
              try {
                await apiClient.put(
                  endpoints.archivePractice(userId ?? '', practice?.id ?? ''),
                  {
                    email,
                    reason,
                    action: 'ARCHIVE'
                  }
                )

                await queryClient.invalidateQueries({
                  queryKey: ['listAllPracticesData']
                })

                // eslint-disable-next-line no-console
                console.log('practicesListLength' + practicesListLength)
                if (practicesListLength > 1) {
                  if (practice?.id === activePracticeId) {
                    const firstNonActivePractice = unarchivedPractices?.find(
                      (p) => p.id !== activePracticeId
                    )
                    handleSwitchToPractice(firstNonActivePractice?.id ?? '')
                  }

                  const token = await getAccessTokenSilently({
                    cacheMode: 'off'
                  })
                  apiClient.defaults.headers.common.Authorization = `Bearer ${token}`
                } else {
                  handleLogout()
                }

                close()
              } catch (error) {
                console.error('Failed to archive practice:', error)
              } finally {
                setIsArchiving(false)
              }
            }}
            isLoading={isArchiving}
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
                {status !== 'archived' ? (
                  <>
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
                  </>
                ) : (
                  ' '
                )}
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

      {(practice?.user_role === 'COMPANY DIRECTOR' ||
        practice?.user_role === 'PRACTICE OWNER') && (
        <Stack spacing='10px'>
          <InfoRow icon='/assets/suit-case-checked.svg'>
            {practice?.subscription_details?.card_last_four_digits ? (
              <>
                {practice?.subscription_details?.card_brand} ••••{' '}
                {practice?.subscription_details?.card_last_four_digits}
              </>
            ) : (
              '-'
            )}
          </InfoRow>

          <Box className={styles.detailsContainer}>
            <Typography
              className='font-style--italic'
              variant='body1'
              color='var(--color-primary-black)'
            >
              Next billing:{' '}
              <strong>
                {practice?.subscription_details?.next_billing_date
                  ? dayjs(
                      practice.subscription_details.next_billing_date
                    ).format('DD/MM/YYYY')
                  : '-'}
              </strong>
            </Typography>
          </Box>
        </Stack>
      )}

      {status === 'archived' ? (
        <Box className={styles.detailsCardActionContainer}>
          <Button
            size='small'
            variant='outlined'
            fullWidth
            color='warning'
            loading={isUnarchiving}
            onClick={() => handleUnarchive()}
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
            onClick={() => handleSwitchToPractice(practice?.id)}
          >
            Switch to this practice
          </Button>
        </Box>
      )}

      <ConfirmationSuccessDialog
        open={successDialogOpen}
        onSubmit={submitSuccessDialog}
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
