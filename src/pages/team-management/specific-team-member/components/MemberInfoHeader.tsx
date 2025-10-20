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
import { useLocation, useNavigate, useParams } from 'react-router'
import ImgIcon from 'src/components/common/ImgIcon'
import { FEATURE_RULE_IDS } from 'src/constants/feature-rules'
import { useFeatureRule } from 'src/hooks/useFeatureRule'
import NominatePracticeManagerTeamList from '../../components/NominatePracticeManagerTeamList'
import ConfirmationSuccessDialog from 'src/components/team-management/InvitationSuccessDialog'
import { paths } from 'src/paths'
import { useAuth0 } from '@auth0/auth0-react'

const MemberInfoHeader = () => {
  const { user } = useAuth0()
  const navigate = useNavigate()
  const location = useLocation()
  const { id = '' } = useParams<{ id: string }>()
  const [isNominateOpen, setIsNominateOpen] = useState(false)
  const [successDialogOpen, setSuccessDialogOpen] = useState(false)
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)

  const { name, email, role, isNominated } = location.state || {}

  const { isEnabled: onboardingCompleted } = useFeatureRule(
    FEATURE_RULE_IDS.ONBOARDING_COMPLETED
  )

  const isMobile = useMediaQuery('(max-width:600px)')

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setMenuAnchorEl(null)
  }

  const handleNominate = () => {
    handleMenuClose()
    if (!isNominated) {
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
          {name
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
            {name}
          </Typography>
          <Typography
            variant='body1'
            color='text.secondary'
            className={styles.memberEmail}
            noWrap
          >
            {email}
          </Typography>
        </Box>
      </Box>

      {/* Right Section */}
      {!(email === user?.email) && (
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
                    color='error'
                    startIcon={
                      <img
                        src='/assets/person-add-white.svg'
                        alt='person icon'
                        width={18}
                        height={18}
                      />
                    }
                  >
                    Deactivate user
                  </Button>
                </MenuItem>

                <MenuItem onClick={handleMenuClose}>
                  <Box display='flex' alignItems='center' gap={1}>
                    <ImgIcon src='/assets/swap-icon.svg' alt='swap' />
                    <Typography noWrap>Update member role</Typography>
                  </Box>
                </MenuItem>

                {!onboardingCompleted && role === 'PRACTICE MANAGER' && (
                  <MenuItem onClick={handleNominate}>
                    <Box display='flex' alignItems='center' gap={1}>
                      <ImgIcon
                        src={
                          isNominated
                            ? '/assets/green-flag.svg'
                            : '/assets/blue-flag.svg'
                        }
                        alt='flag icon'
                      />
                      <Typography noWrap>
                        {isNominated ? 'Already nominated' : 'Nominate Now'}
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
                  color='error'
                  startIcon={
                    <img
                      src='/assets/person-add-white.svg'
                      alt='person icon'
                      width={18}
                      height={18}
                    />
                  }
                >
                  Deactivate user
                </Button>

                <Tooltip placement='top' title='Update member role'>
                  <IconButton
                    size='small'
                    onClick={() => console.log('swap')}
                    aria-label='swap member'
                  >
                    <ImgIcon src='/assets/swap-icon.svg' alt='swap' />
                  </IconButton>
                </Tooltip>

                {!onboardingCompleted && role === 'PRACTICE MANAGER' && (
                  <Tooltip
                    placement='top'
                    title={
                      isNominated
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
                          isNominated
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
        name={name ?? ''}
        userId={id ?? ''}
      />

      <ConfirmationSuccessDialog
        open={successDialogOpen}
        onClose={() => {
          setSuccessDialogOpen(false)
          navigate(paths.teamManagement.gotoSpecificTeamMember(id), {
            state: { name, email, role, isNominated: true }
          })
        }}
        title='Nomination successful!'
      >
        <Typography variant='body2' color='text.secondary'>
          You’ve successfully nominated{' '}
          <Typography component='span' color='text.primary' fontWeight={700}>
            {name}
          </Typography>{' '}
          to complete the practice onboarding process.
        </Typography>

        <Typography variant='body2' color='text.secondary' mt={1}>
          They’ll receive an email notification and now have access to the
          onboarding form.
        </Typography>
      </ConfirmationSuccessDialog>
    </Box>
  )
}

export default MemberInfoHeader
