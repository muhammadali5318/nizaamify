import { useRef, useState } from 'react'
import AppBar from '@mui/material/AppBar'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import ClickAwayListener from '@mui/material/ClickAwayListener'
import Divider from '@mui/material/Divider'
import Grow from '@mui/material/Grow'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import MenuList from '@mui/material/MenuList'
import Paper from '@mui/material/Paper'
import Popper from '@mui/material/Popper'
import Stack from '@mui/material/Stack'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import MenuIcon from '@mui/icons-material/Menu'
import LogoutIcon from '@mui/icons-material/Logout'
import LightModeIcon from '@mui/icons-material/LightModeOutlined'
import DarkModeIcon from '@mui/icons-material/DarkModeOutlined'
import { useTranslation } from 'react-i18next'
import { useSession } from 'src/features/auth/AuthProvider'
import LanguageSelector from 'src/components/language-selector/LanguageSelector'
import { Button, Tooltip } from 'src/components/ui'
import { useThemeMode } from 'src/lib/themeMode'

export interface TopBarProps {
  /** Width reserved for the desktop sidebar (px). Drives the AppBar offset. */
  sidebarWidth: number
  /** Hamburger toggles the mobile drawer. Hidden on desktop. */
  onMobileMenuToggle: () => void
  /** Mobile-only flag — show hamburger, drop the sidebar offset. */
  isMobile: boolean
  /** Sign-out handler (caller owns the side effects). */
  onLogout: () => void
}

/**
 * Top navigation bar (spec §5.1). Dark surface (bg-surface-inverse from
 * theme), 56px mobile / 64px desktop. Hamburger on lead (mobile only),
 * spacer, language selector + user menu on trail. Logical CSS for RTL.
 */
export function TopBar({
  sidebarWidth,
  onMobileMenuToggle,
  isMobile,
  onLogout
}: TopBarProps) {
  const { t } = useTranslation('common')
  const { user } = useSession()
  const { resolved, toggle } = useThemeMode()
  const [profileOpen, setProfileOpen] = useState(false)
  const profileAnchor = useRef<HTMLButtonElement | null>(null)
  const isDark = resolved === 'dark'

  return (
    <AppBar
      position='fixed'
      sx={{
        width: { md: `calc(100% - ${sidebarWidth}px)` },
        marginInlineStart: { md: `${sidebarWidth}px` },
        // Translucent in both modes so the body's amber wash bleeds through
        // for that "glass over warm light" feel the inspiration screenshots
        // have. Use color-mix on surface-base so we get an 80% opacity tint
        // without pinning a literal rgba(...) — token-safe across themes.
        backgroundColor:
          'color-mix(in srgb, var(--surface-base) 80%, transparent)',
        color: 'var(--text-primary)',
        borderBottom: '1px solid var(--border-subtle)',
        backdropFilter: 'saturate(180%) blur(12px)',
        WebkitBackdropFilter: 'saturate(180%) blur(12px)'
      }}
    >
      <Toolbar
        sx={{
          gap: 1,
          minHeight: { xs: 56, md: 64 }
        }}
      >
        {isMobile && (
          <IconButton
            edge='start'
            onClick={onMobileMenuToggle}
            aria-label={t('nav.open_navigation', 'Open navigation')}
            sx={{ color: 'inherit' }}
          >
            <MenuIcon />
          </IconButton>
        )}
        <Box sx={{ flex: 1 }} />
        <Tooltip
          title={
            isDark
              ? t('nav.theme.switch_to_light', 'Switch to light mode')
              : t('nav.theme.switch_to_dark', 'Switch to dark mode')
          }
        >
          <IconButton
            onClick={toggle}
            aria-label={
              isDark
                ? t('nav.theme.switch_to_light', 'Switch to light mode')
                : t('nav.theme.switch_to_dark', 'Switch to dark mode')
            }
            aria-pressed={isDark}
            sx={{
              color: 'inherit',
              transition: 'transform var(--duration-fast) var(--ease-out)',
              '&:hover': { transform: 'rotate(12deg)' }
            }}
          >
            {isDark ? (
              <LightModeIcon fontSize='small' />
            ) : (
              <DarkModeIcon fontSize='small' />
            )}
          </IconButton>
        </Tooltip>
        <LanguageSelector />
        <IconButton
          ref={profileAnchor}
          onClick={() => setProfileOpen((v) => !v)}
          size='small'
          aria-label={t('nav.profile_menu', 'Profile menu')}
          sx={{ color: 'inherit' }}
        >
          <Avatar
            sx={{
              width: 32,
              height: 32,
              bgcolor: 'var(--brand-400)',
              color: 'var(--brand-900)',
              fontWeight: 600,
              fontSize: '0.875rem'
            }}
          >
            {(user?.email?.[0] ?? '?').toUpperCase()}
          </Avatar>
        </IconButton>
        <Popper
          open={profileOpen}
          anchorEl={profileAnchor.current}
          placement='bottom-end'
          transition
          disablePortal={false}
          sx={{ zIndex: 1400 }}
        >
          {({ TransitionProps }) => (
            <Grow {...TransitionProps}>
              <Paper
                elevation={4}
                sx={{
                  minWidth: 240,
                  mt: 1,
                  border: '1px solid var(--border-default)',
                  boxShadow: 'var(--shadow-md)'
                }}
              >
                <ClickAwayListener onClickAway={() => setProfileOpen(false)}>
                  <MenuList sx={{ p: 1 }}>
                    <MenuItem disabled sx={{ opacity: '1 !important' }}>
                      <Stack>
                        <Typography
                          variant='body2'
                          sx={{ fontWeight: 600, color: 'var(--text-primary)' }}
                        >
                          {user?.email}
                        </Typography>
                      </Stack>
                    </MenuItem>
                    <Divider />
                    <Box sx={{ p: 1 }}>
                      <Button
                        variant='secondary'
                        fullWidth
                        startIcon={<LogoutIcon />}
                        onClick={onLogout}
                      >
                        {t('actions.logout')}
                      </Button>
                    </Box>
                  </MenuList>
                </ClickAwayListener>
              </Paper>
            </Grow>
          )}
        </Popper>
      </Toolbar>
    </AppBar>
  )
}

export default TopBar
