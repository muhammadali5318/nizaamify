import * as React from 'react'
import {
  AppBar,
  Avatar,
  Box,
  Button,
  ClickAwayListener,
  CssBaseline,
  Divider,
  Drawer,
  Grow,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  MenuList,
  Paper,
  Popper,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import MenuIcon from '@mui/icons-material/Menu'
import StorefrontIcon from '@mui/icons-material/Storefront'
import LogoutIcon from '@mui/icons-material/Logout'
import {
  Link as RouterLink,
  Outlet,
  useLocation,
  useNavigate
} from 'react-router'
import { useTranslation } from 'react-i18next'
import { useSession } from 'src/features/auth/AuthProvider'
import { supabase } from 'src/lib/supabase'
import { useNavSections } from 'src/layouts/navConfig'
import LanguageSelector from 'src/components/language-selector/LanguageSelector'
import DashboardBanner from 'src/features/subscription/DashboardBanner'
import { useQueryClient } from '@tanstack/react-query'
import { paths } from 'src/paths'

const SIDEBAR_WIDTH = 264

export default function AppShell() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation('common')
  const { user } = useSession()
  const queryClient = useQueryClient()
  const sections = useNavSections()

  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [profileOpen, setProfileOpen] = React.useState(false)
  const profileAnchor = React.useRef<HTMLButtonElement | null>(null)

  React.useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    queryClient.clear()
    navigate(paths.login, { replace: true })
  }

  const drawerContent = (
    <Box sx={{ width: SIDEBAR_WIDTH, p: 2 }}>
      <Stack
        direction='row'
        spacing={1}
        alignItems='center'
        sx={{ px: 1, pb: 2 }}
      >
        <StorefrontIcon color='primary' />
        <Typography variant='h6' fontWeight={700}>
          {t('app_name')}
        </Typography>
      </Stack>
      <Divider sx={{ mb: 1 }} />
      {sections.map((section) => (
        <Box key={section.title} sx={{ mt: 1 }}>
          <Typography
            variant='caption'
            color='text.secondary'
            sx={{ px: 1, fontWeight: 700, textTransform: 'uppercase' }}
          >
            {section.title}
          </Typography>
          <List dense disablePadding>
            {section.items.map((item) => {
              const active = location.pathname.startsWith(item.to)
              const Icon = item.icon
              return (
                <ListItem key={item.to} disablePadding>
                  <ListItemButton
                    component={RouterLink}
                    to={item.to}
                    selected={active}
                    sx={{ borderRadius: 2, my: 0.25 }}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Icon fontSize='small' />
                    </ListItemIcon>
                    <ListItemText primary={item.label} />
                  </ListItemButton>
                </ListItem>
              )
            })}
          </List>
        </Box>
      ))}
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <CssBaseline />

      <AppBar
        position='fixed'
        elevation={0}
        sx={{
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderBottom: 1,
          borderColor: 'divider',
          width: { md: `calc(100% - ${SIDEBAR_WIDTH}px)` },
          ms: { md: `${SIDEBAR_WIDTH}px` }
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
          {isMobile && (
            <IconButton
              edge='start'
              onClick={() => setMobileOpen(true)}
              aria-label='open navigation'
            >
              <MenuIcon />
            </IconButton>
          )}
          <Box sx={{ flex: 1 }} />
          <LanguageSelector />
          <IconButton
            ref={profileAnchor}
            onClick={() => setProfileOpen((v) => !v)}
            size='small'
            aria-label='profile menu'
          >
            <Avatar sx={{ width: 32, height: 32 }}>
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
                <Paper elevation={4} sx={{ minWidth: 240 }}>
                  <ClickAwayListener onClickAway={() => setProfileOpen(false)}>
                    <MenuList sx={{ p: 1 }}>
                      <MenuItem disabled sx={{ opacity: '1 !important' }}>
                        <Stack>
                          <Typography variant='body2' fontWeight={700}>
                            {user?.email}
                          </Typography>
                        </Stack>
                      </MenuItem>
                      <Divider />
                      <Box sx={{ p: 1 }}>
                        <Button
                          fullWidth
                          variant='outlined'
                          startIcon={<LogoutIcon />}
                          onClick={handleLogout}
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

      {isMobile ? (
        <Drawer
          variant='temporary'
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
        >
          {drawerContent}
        </Drawer>
      ) : (
        <Drawer
          variant='permanent'
          sx={{
            width: SIDEBAR_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: SIDEBAR_WIDTH,
              boxSizing: 'border-box',
              borderInlineEnd: 1,
              borderColor: 'divider'
            }
          }}
          open
        >
          {drawerContent}
        </Drawer>
      )}

      <Box
        component='main'
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${SIDEBAR_WIDTH}px)` },
          minHeight: '100vh',
          bgcolor: 'background.default'
        }}
      >
        <Toolbar />
        <DashboardBanner />
        <Outlet />
      </Box>
    </Box>
  )
}
