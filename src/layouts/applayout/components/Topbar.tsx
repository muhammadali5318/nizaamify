import React, { useRef, useState } from 'react'
import {
  Avatar,
  Box,
  Button,
  Chip,
  ClickAwayListener,
  Divider,
  Grow,
  IconButton,
  MenuItem,
  MenuList,
  Paper,
  Popper,
  Stack,
  Typography,
  useMediaQuery
} from '@mui/material'
import { useNavigate } from 'react-router'
import { paths } from 'src/paths'
import styles from './Topbar.module.scss'

type TopbarProps = {
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
}

const profile = {
  email: 'template@starter.app',
  userFullName: 'Template User',
  userRole: 'Admin'
}

const ProfilePopper: React.FC<ProfilePopperProps> = ({
  anchorEl,
  open,
  onClose,
  onLogout,
  onSettings
}) => {
  const handleListKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Tab' || event.key === 'Escape') {
      event.preventDefault()
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
                <Box sx={{ padding: '12px 10px' }}>
                  <Stack direction='row' spacing={1.5} alignItems='start'>
                    <Avatar
                      alt='Template user avatar'
                      src='/assets/profile-avatar.svg'
                    />
                    <Stack>
                      <Typography
                        variant='body1'
                        color='var(--color-text-primary)'
                      >
                        {profile.userFullName}
                      </Typography>
                      <Typography
                        variant='caption'
                        color='var(--color-primary-light)'
                        className='font-weight--700'
                      >
                        {profile.email}
                      </Typography>
                      <Box>
                        <Chip
                          label={profile.userRole}
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

                <Box px='6px'>
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

const Topbar: React.FC<TopbarProps> = ({ title, icon, rightSlot }) => {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement | null>(null)
  const isMobile = useMediaQuery('(max-width:600px)')

  const handleToggle = () => {
    setOpen((prev) => !prev)
  }

  const handleClose = () => {
    setOpen(false)
  }

  const handleSettings = () => {
    setOpen(false)
    navigate(paths.settings)
  }

  const handleLogout = () => {
    setOpen(false)
    navigate(paths.dashboard)
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
            {profile.userFullName}
          </Typography>
          <Typography
            variant='caption'
            color='var(--color-primary-light)'
            className='font-weight--700'
          >
            {profile.userRole}
          </Typography>
        </Box>

        <IconButton
          ref={anchorRef}
          onClick={handleToggle}
          size='small'
          aria-label='Open profile menu'
        >
          <Avatar src='/assets/profile-avatar.svg'>
            {profile.userFullName[0]}
          </Avatar>
        </IconButton>

        <ProfilePopper
          anchorEl={anchorRef.current}
          open={open}
          onClose={handleClose}
          onLogout={handleLogout}
          onSettings={handleSettings}
        />
      </Box>
    </Box>
  )
}

export default Topbar
