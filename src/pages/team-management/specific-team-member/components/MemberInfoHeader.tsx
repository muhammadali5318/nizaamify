/* eslint-disable no-console */
// src/components/your-path/MemberInfoHeader.tsx
import React, { useState } from 'react'
import {
  Avatar,
  Box,
  Button,
  IconButton,
  Tooltip,
  Typography,
  Menu,
  MenuItem,
  useMediaQuery
} from '@mui/material'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import styles from './MemberInfoHeader.module.scss'
import { useParams } from 'react-router'
import ImgIcon from 'src/components/common/ImgIcon'
import NominatePracticeManagerTeamList from '../../components/NominatePracticeManagerTeamList'
import ConfirmationSuccessDialog from 'src/components/team-management/InvitationSuccessDialog'
import { useAuth0 } from '@auth0/auth0-react'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import UpdateMemberRoleModal from '../../components/UpdateMemberRoleModal'
import { useHasPermission } from 'src/config/module-permissions'
import { selectSelectedUser } from 'src/store/slices/team-management/selectedUserSlice'
import { useSelector } from 'react-redux'
import DeactivateUserModal from '../../components/DeactivateUserModal'
import { useActivePractice } from 'src/hooks/useActivePractice'

const MemberInfoHeader = () => {
  const canViewAndEditTeamMembers = useHasPermission('user.manage_users_roles')
  const { isOnboardingCompleted } = useActivePractice()
  const selectedUser = useSelector(selectSelectedUser)
  const [openUnlinkUser, setOpenUnlinkUser] = useState(false)

  const { user } = useAuth0()
  const { id = '' } = useParams<{ id: string }>()
  const [isNominateOpen, setIsNominateOpen] = useState(false)
  const [successDialogOpen, setSuccessDialogOpen] = useState(false)

  // State for Update Member Role Modal
  const [isUpdateMemberOpen, setIsUpdateMemberOpen] = useState(false)
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)

  const isMobile = useMediaQuery('(max-width:600px)')

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setMenuAnchorEl(null)
  }

  const handleNominate = () => {
    handleMenuClose()
    if (!selectedUser?.is_nominated) {
      setIsNominateOpen(true)
    } else {
      console.log('Already nominated')
    }
  }

  return (
    <Box className={styles.memberInfoHeaderRoot}>
      {/* Left Section */}
      <Box className={styles.memberInfoHeaderContainer}>
        <Avatar
          sx={{
            width: { xs: 32, sm: 40 },
            height: { xs: 32, sm: 40 },
            flex: '0 0 auto'
          }}
        >
          {selectedUser?.user_name
            ?.split(' ')
            .map((n: string) => n[0])
            .join('')
            .toUpperCase()}
        </Avatar>

        <Box className={styles.infoBox} sx={{ minWidth: 0, flex: '1 1 auto' }}>
          <Typography
            variant='h6'
            color='text.primary'
            fontWeight={700}
            className={styles.memberName}
            noWrap
          >
            {selectedUser?.user_name}
          </Typography>
          <Typography
            variant='body1'
            color='text.secondary'
            className={styles.memberEmail}
            noWrap
          >
            {selectedUser?.email}
          </Typography>
        </Box>
      </Box>

      {/* Right Section */}
      {!(selectedUser?.email === user?.email) && canViewAndEditTeamMembers && (
        <>
          {isMobile ? (
            <>
              <IconButton onClick={handleMenuOpen} aria-label='more'>
                <MoreVertIcon />
              </IconButton>

              <Menu
                anchorEl={menuAnchorEl}
                open={Boolean(menuAnchorEl)}
                onClose={handleMenuClose}
              >
                <MenuItem onClick={handleMenuClose}>
                  <Button
                    fullWidth
                    variant='contained'
                    color={
                      selectedUser?.has_other_active_practices
                        ? 'warning'
                        : 'error'
                    }
                    onClick={() => setOpenUnlinkUser(true)}
                    startIcon={
                      <img
                        src='/assets/person-add-white.svg'
                        alt='person icon'
                        width={18}
                        height={18}
                      />
                    }
                  >
                    {selectedUser?.has_other_active_practices
                      ? 'Unlink user'
                      : 'Deactivate user'}
                  </Button>
                </MenuItem>

                <MenuItem onClick={handleMenuClose}>
                  <Box
                    display='flex'
                    alignItems='center'
                    gap={1}
                    onClick={() => setIsUpdateMemberOpen(true)}
                  >
                    <ImgIcon src='/assets/swap-icon.svg' alt='swap' />
                    <Typography noWrap>Update member role</Typography>
                  </Box>
                </MenuItem>

                {!isOnboardingCompleted &&
                  selectedUser?.user_role === 'PRACTICE MANAGER' && (
                    <MenuItem onClick={handleNominate}>
                      <Box display='flex' alignItems='center' gap={1}>
                        <ImgIcon
                          src={
                            selectedUser?.is_nominated
                              ? '/assets/green-flag.svg'
                              : '/assets/blue-flag.svg'
                          }
                          alt='flag icon'
                        />
                        <Typography noWrap>
                          {selectedUser?.is_nominated
                            ? 'Already nominated'
                            : 'Nominate Now'}
                        </Typography>
                      </Box>
                    </MenuItem>
                  )}
              </Menu>
            </>
          ) : (
            <>
              <Box className={styles.memberActionsContainer}>
                <Button
                  size='medium'
                  variant='contained'
                  color={
                    selectedUser?.has_other_active_practices
                      ? 'warning'
                      : 'error'
                  }
                  onClick={() => setOpenUnlinkUser(true)}
                  startIcon={
                    <img
                      src='/assets/person-add-white.svg'
                      alt='person icon'
                      width={18}
                      height={18}
                    />
                  }
                >
                  {selectedUser?.has_other_active_practices
                    ? 'Unlink user'
                    : 'Deactivate user'}
                </Button>

                <Tooltip placement='top' title='Update member role'>
                  <Box
                    component='span'
                    sx={{
                      display: 'inline-flex',
                      verticalAlign: 'middle'
                    }}
                  >
                    <IconButton
                      size='small'
                      onClick={() => setIsUpdateMemberOpen(true)}
                      aria-label='swap member'
                    >
                      <SwapHorizIcon fontSize='small' />
                    </IconButton>
                  </Box>
                </Tooltip>

                {!isOnboardingCompleted &&
                  selectedUser?.user_role === 'PRACTICE MANAGER' && (
                    <Tooltip
                      placement='top'
                      title={
                        selectedUser?.is_nominated
                          ? 'Already nominated'
                          : 'Nominate to complete onboarding'
                      }
                    >
                      <IconButton
                        size='small'
                        aria-label='Nomination flag'
                        onClick={handleNominate}
                      >
                        <ImgIcon
                          src={
                            selectedUser?.is_nominated
                              ? '/assets/green-flag.svg'
                              : '/assets/blue-flag.svg'
                          }
                          alt='flag icon'
                        />
                      </IconButton>
                    </Tooltip>
                  )}
              </Box>
            </>
          )}
        </>
      )}

      {/* Nomination Dialog */}
      <NominatePracticeManagerTeamList
        open={isNominateOpen}
        onClose={() => setIsNominateOpen(false)}
        onSuccess={() => setSuccessDialogOpen(true)}
        name={selectedUser?.user_name ?? ''}
        userId={id ?? ''}
      />

      <ConfirmationSuccessDialog
        open={successDialogOpen}
        onClose={() => {
          setSuccessDialogOpen(false)
        }}
        onSubmit={() => {
          setSuccessDialogOpen(false)
        }}
        title='Nomination successful!'
      >
        <Typography variant='body2' color='text.secondary'>
          You’ve successfully nominated{' '}
          <Typography component='span' color='text.primary' fontWeight={700}>
            {selectedUser?.user_name}
          </Typography>{' '}
          to complete the practice onboarding process.
        </Typography>

        <Typography variant='body2' color='text.secondary' mt={1}>
          They’ll receive an email notification and now have access to the
          onboarding form.
        </Typography>
      </ConfirmationSuccessDialog>

      {/* swap member role Dialogue */}
      <UpdateMemberRoleModal
        open={isUpdateMemberOpen}
        onClose={() => setIsUpdateMemberOpen(false)}
        member={selectedUser}
      />

      <DeactivateUserModal
        open={openUnlinkUser}
        onClose={() => setOpenUnlinkUser(false)}
        member={selectedUser}
        mode={selectedUser?.has_other_active_practices ? 'unlink' : 'delete'}
        reRouteToMainPage={true}
      />
    </Box>
  )
}

export default MemberInfoHeader
