import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import CssBaseline from '@mui/material/CssBaseline'
import Toolbar from '@mui/material/Toolbar'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Sidebar, TopBar } from 'src/components/layout'
import DashboardBanner from 'src/features/subscription/DashboardBanner'
import { supabase } from 'src/lib/supabase'
import { paths } from 'src/paths'

const SIDEBAR_WIDTH = 240

/**
 * App shell — composes TopBar + Sidebar + main outlet (spec §5.1). Routes
 * render their content inside the main region; PageHeader and any
 * page-specific max-width container live in each route.
 */
export default function AppShell() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()

  const [mobileOpen, setMobileOpen] = useState(false)

  // Close mobile drawer when route changes.
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    queryClient.clear()
    navigate(paths.login, { replace: true })
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <CssBaseline />

      <TopBar
        sidebarWidth={SIDEBAR_WIDTH}
        isMobile={isMobile}
        onMobileMenuToggle={() => setMobileOpen(true)}
        onLogout={handleLogout}
      />

      <Sidebar
        width={SIDEBAR_WIDTH}
        isMobile={isMobile}
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      <Box
        component='main'
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${SIDEBAR_WIDTH}px)` },
          minHeight: '100vh',
          backgroundColor: 'var(--surface-subtle)'
        }}
      >
        {/* Spacer for the fixed AppBar — matches Toolbar min-heights. */}
        <Toolbar sx={{ minHeight: { xs: 56, md: 64 } }} />
        <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 2, md: 3 } }}>
          <DashboardBanner />
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}
