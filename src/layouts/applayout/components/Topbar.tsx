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
  Stack
} from '@mui/material'
import styles from './Topbar.module.scss'
import { useAuth0 } from '@auth0/auth0-react'

type topbarProps = {
  title: string
  icon: string
}

type ProfilePopperProps = {
  anchorEl: HTMLButtonElement | null
  open: boolean
  onClose: (event?: Event | React.SyntheticEvent) => void
  onLogout: () => void
  onSettings?: () => void
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
                <Box sx={{ px: 1.5, py: 1 }}>
                  <Stack direction='row' spacing={1} alignItems='center'>
                    <Avatar src='/assets/profile-avatar.svg' alt='avatar' />
                    <Box>
                      <Typography
                        variant='subtitle2'
                        className='font-weight--700'
                      >
                        {user?.name}
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>
                        {user?.email}
                      </Typography>
                    </Box>
                  </Stack>
                </Box>

                <Divider sx={{ my: 1 }} />

                <MenuItem
                  onClick={() => {
                    onSettings && onSettings()
                    onClose()
                  }}
                >
                  Settings
                </MenuItem>

                <Divider />

                <Box sx={{ px: 1, py: 1 }}>
                  <Button
                    fullWidth
                    variant='outlined'
                    onClick={onLogout}
                    aria-label='Logout'
                  >
                    Logout
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

const Topbar: React.FC<topbarProps> = ({ title, icon }) => {
  const { user, logout } = useAuth0()
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement | null>(null)

  const handleToggle = () => {
    setOpen((prev) => !prev)
  }

  const handleClose = (event?: Event | React.SyntheticEvent) => {
    setOpen(false)
  }

  const handleLogout = () => {
    // auth0-react v2 uses logout with logoutParams, older versions accept returnTo directly.
    // adjust if your project requires a different signature.
    logout({ logoutParams: { returnTo: window.location.origin } })
  }

  const handleSettings = () => {
    // Example: close popper and navigate/open settings modal.
    // You can replace this with useNavigate() or open a modal instead.
    setOpen(false)
  }

  return (
    <Box className={styles.topbar}>
      <Box className={styles.topbarTitleContainer}>
        <img src={`/assets/${icon}`} alt={`${icon} active icon`} />
        <Typography variant='h5' className='font-weight--700'>
          {title}
        </Typography>
      </Box>

      <Box className={styles.topbarActionContainer}>
        <img src='/assets/search.svg' alt='search icon' />
        <img src='/assets/notification.svg' alt='Notification icon' />

        <Box className={styles.profileTitle}>
          <Typography variant='body1' className='font-weight--700'>
            {user?.name}
          </Typography>
          <Typography
            variant='caption'
            color='var(--color-primary-light)'
            className='font-weight--700'
          >
            Practice Admin
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
          <Avatar src='/assets/profile-avatar.svg' alt='profile avatar' />
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
