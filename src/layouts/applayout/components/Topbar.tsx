import React, { useRef, useState } from 'react'
import {
  Box,
  Typography,
  Avatar,
  IconButton,
  Popper,
  Paper,
  ClickAwayListener,
  MenuList,
  MenuItem,
  Divider,
  Grow,
  Button,
  Stack,
  Chip,
  useMediaQuery
} from '@mui/material'
import styles from './Topbar.module.scss'
import { useAuth0 } from '@auth0/auth0-react'

type topbarProps = {
  title: string
  icon: string
  rightSlot?: React.ReactNode
}

type ProfilePopperProps = {
  anchorEl: HTMLButtonElement | null
  open: boolean
  onClose: (event?: Event | React.SyntheticEvent) => void
  onLogout: () => void
  onSettings: () => void
  user?: any
}

// Separate function/component for the floating container
const ProfilePopper: React.FC<ProfilePopperProps> = ({
  anchorEl,
  open,
  onClose,
  onLogout,
  onSettings,
  user
}) => {
  const handleListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab' || e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <Popper
      open={open}
      anchorEl={anchorEl}
      placement='bottom-end'
      transition
      disablePortal={false}
      style={{ zIndex: 1400 }}
    >
      {({ TransitionProps }) => (
        <Grow {...TransitionProps} style={{ transformOrigin: 'right top' }}>
          <Paper elevation={4} sx={{ minWidth: 240, borderRadius: 2 }}>
            <ClickAwayListener onClickAway={onClose}>
              <MenuList
                id='profile-menu'
                autoFocusItem={open}
                onKeyDown={handleListKeyDown}
                aria-label='Profile menu'
                sx={{ p: 0 }}
              >
                {/* Profile summary */}
                <Box sx={{ padding: '12px 10px' }}>
                  <Stack direction='row' spacing={1.5} alignItems='start'>
                    <Avatar src={user?.picture} alt='avatar' />
                    <Stack>
                      <Typography
                        variant='body1'
                        color='var(--color-text-primary)'
                      >
                        {user?.name}
                      </Typography>
                      <Typography
                        variant='caption'
                        color='var(--color-primary-light)'
                        className='font-weight--700'
                      >
                        {user?.email}
                      </Typography>
                      <Box>
                        <Chip
                          label={user?.organizations_with_roles[0]?.roles[0]}
                          size='small'
                          variant='outlined'
                          sx={{
                            fontWeight: 700,
                            borderWidth: 2,
                            borderColor: 'var(--color-primary)',
                            borderStyle: 'solid',
                            color: 'var(--color-primary)'
                          }}
                        />
                      </Box>
                    </Stack>
                  </Stack>
                </Box>

                <Divider sx={{ my: '8px' }} />

                <Box px={'6px'}>
                  <MenuItem
                    onClick={() => {
                      onSettings()
                      onClose()
                    }}
                  >
                    <img src='/assets/person.svg' alt='person icon' />
                    <Typography variant='body2' color='text.primary' pl={1}>
                      Profile
                    </Typography>
                  </MenuItem>

                  <MenuItem
                    onClick={() => {
                      onSettings()
                      onClose()
                    }}
                  >
                    <img
                      src='/assets/settings-greyed.svg'
                      alt='settings icon'
                    />

                    <Typography variant='body2' color='text.primary' pl={1}>
                      Account Settings
                    </Typography>
                  </MenuItem>
                </Box>

                <Divider sx={{ my: '8px' }} />

                <Box sx={{ p: '10px', pt: 0 }}>
                  <Button
                    fullWidth
                    variant='outlined'
                    onClick={onLogout}
                    aria-label='Logout'
                    sx={{
                      display: 'flex',
                      padding: '4px 16px',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      border: 'none',
                      borderRadius: '10px',
                      background: 'var(--grey-200)',
                      gap: '6px',
                      alignSelf: 'stretch'
                    }}
                  >
                    <img
                      src='/assets/logout-icon.svg'
                      alt='Logout'
                      style={{ width: 20, height: 20, objectFit: 'contain' }}
                    />
                    <span>Sign out</span>
                  </Button>
                </Box>
              </MenuList>
            </ClickAwayListener>
          </Paper>
        </Grow>
      )}
    </Popper>
  )
}

const Topbar: React.FC<topbarProps> = ({ title, icon, rightSlot }) => {
  const { user, logout } = useAuth0()
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement | null>(null)
  const isMobile = useMediaQuery('(max-width:600px)')

  const handleToggle = () => {
    setOpen((prev) => !prev)
  }

  const handleClose = () => {
    setOpen(false)
  }
  const handleLogout = () => {
    logout({ logoutParams: { returnTo: window.location.origin } })
  }

  const handleSettings = () => {
    setOpen(false)
  }

  return (
    <Box
      className={styles.topbar}
      sx={{
        pl: {
          xs: '16px',
          sm: '24px',
          md: 0
        }
      }}
    >
      <Box className={styles.topbarTitleContainer}>
        {rightSlot}

        {isMobile && (
          <Box>
            <img src='/assets/monai-logo.svg' alt='monai logo' />
          </Box>
        )}
        <Box
          sx={{
            display: { xs: 'none', sm: 'flex' }
          }}
        >
          <img src={`/assets/${icon}`} alt={`${icon} active icon`} />
        </Box>

        <Typography
          variant='h5'
          className='font-weight--700'
          sx={{
            display: { xs: 'none', sm: 'block' }
          }}
        >
          {title}
        </Typography>
      </Box>

      <Box className={styles.topbarActionContainer}>
        <Box
          className={styles.profileTitle}
          sx={{
            display: { xs: 'none', sm: 'block' }
          }}
        >
          <Typography variant='body1' className='font-weight--700'>
            {user?.name}
          </Typography>
          <Typography
            variant='caption'
            color='var(--color-primary-light)'
            className='font-weight--700'
          >
            {user?.organizations_with_roles[0]?.roles[0]}
          </Typography>
        </Box>

        {/* Avatar button (anchor for the floating container) */}
        <IconButton
          ref={anchorRef}
          onClick={handleToggle}
          aria-controls={open ? 'profile-menu' : undefined}
          aria-haspopup='true'
          aria-expanded={open ? 'true' : undefined}
          size='small'
        >
          <Avatar src={user?.picture} alt='profile avatar' />
        </IconButton>

        {/* Use the separate ProfilePopper function/component */}
        <ProfilePopper
          anchorEl={anchorRef.current}
          open={open}
          onClose={handleClose}
          onLogout={handleLogout}
          onSettings={handleSettings}
          user={user}
        />
      </Box>
    </Box>
  )
}

export default Topbar
