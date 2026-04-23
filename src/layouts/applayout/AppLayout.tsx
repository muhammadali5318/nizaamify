import * as React from 'react'
import Box from '@mui/material/Box'
import CssBaseline from '@mui/material/CssBaseline'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import ListSubheader from '@mui/material/ListSubheader'
import MuiDrawer from '@mui/material/Drawer'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import { Stack, Tooltip, Typography, useMediaQuery } from '@mui/material'
import { Link, Outlet, useLocation } from 'react-router'
import styles from './AppLayout.module.scss'
import {
  Drawer as DesktopDrawer,
  MenuItemData,
  menuSections
} from './applayout-config'
import MobileTopBar from './components/MobileTopbar'
import PracticeSelector from './components/PracticeSelector'
import Topbar from './components/Topbar'

function findScrollParent(el: HTMLElement | null): HTMLElement | Window {
  if (!el) return window

  let cur: HTMLElement | null = el
  while (cur) {
    const style = window.getComputedStyle(cur)
    const overflowY = style.overflowY
    const isScrollable =
      (overflowY === 'auto' ||
        overflowY === 'scroll' ||
        overflowY === 'overlay') &&
      cur.scrollHeight > cur.clientHeight

    if (isScrollable) {
      return cur
    }

    cur = cur.parentElement
  }

  return window
}

export default function AppLayout() {
  const location = useLocation()
  const isMobile = useMediaQuery('(max-width:768px)')
  const isCollapsedBreakpoint = useMediaQuery('(max-width:1024px)')

  const [open, setOpen] = React.useState<boolean>(() => {
    try {
      if (typeof window === 'undefined') return true
      const stored = localStorage.getItem('drawerOpen')
      return stored ? JSON.parse(stored) : true
    } catch {
      return true
    }
  })

  const [mobileOpen, setMobileOpen] = React.useState(false)
  const outletRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    const stored =
      typeof window !== 'undefined' ? localStorage.getItem('drawerOpen') : null
    const parsed = stored ? JSON.parse(stored) : true

    if (isCollapsedBreakpoint) {
      setOpen(false)
      return
    }

    setOpen(parsed)
  }, [isCollapsedBreakpoint])

  const toggleDrawer = React.useCallback(() => {
    setOpen((prev) => {
      const next = !prev

      try {
        localStorage.setItem('drawerOpen', JSON.stringify(next))
      } catch {
        // Ignore storage failures in template mode.
      }

      return next
    })
  }, [])

  const handleMobileToggle = React.useCallback(() => {
    setMobileOpen((prev) => !prev)
  }, [])

  const activeItem = React.useMemo<MenuItemData | null>(() => {
    for (const section of menuSections) {
      const found = section.items.find((item) =>
        location.pathname.startsWith(item.to)
      )

      if (found) {
        return found
      }
    }

    return menuSections[0]?.items[0] ?? null
  }, [location.pathname])

  React.useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
  }, [])

  React.useEffect(() => {
    const scrollParent = findScrollParent(outletRef.current)

    const doScrollTop = () => {
      if (scrollParent === window) {
        window.scrollTo(0, 0)
        return
      }

      ;(scrollParent as HTMLElement).scrollTop = 0
    }

    doScrollTop()

    requestAnimationFrame(() => {
      doScrollTop()
      requestAnimationFrame(doScrollTop)
    })

    const timeoutId = window.setTimeout(doScrollTop, 60)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [location.pathname])

  const renderDrawerContent = React.useCallback(
    (showLabels: boolean) => (
      <Stack spacing={2}>
        <Box
          className={styles.toolbarHeader}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: showLabels ? 'space-between' : 'center'
          }}
        >
          {showLabels && <img src='/assets/monai-logo.svg' alt='monai icon' />}
          <IconButton
            onClick={isMobile ? handleMobileToggle : toggleDrawer}
            className={styles.toggleBtn}
            sx={{ p: '0px 16px' }}
            aria-label={isMobile ? 'toggle mobile menu' : 'toggle sidebar'}
          >
            <img
              src={`/assets/${
                showLabels
                  ? 'layout-navbar-collapse.svg'
                  : 'layout-navbar-expand.svg'
              }`}
              alt=''
              aria-hidden
            />
          </IconButton>
        </Box>

        <PracticeSelector />

        {menuSections.map((section) => (
          <List
            key={section.title}
            subheader={
              <ListSubheader
                sx={{
                  bgcolor: 'transparent',
                  fontWeight: 'bold',
                  color: 'text.secondary',
                  fontSize: '0.75rem',
                  lineHeight: 2,
                  textAlign: showLabels ? 'left' : 'center',
                  padding: '0px'
                }}
              >
                <Typography
                  variant='subtitle2'
                  color='var(--color-primary-light)'
                >
                  {section.title}
                </Typography>
              </ListSubheader>
            }
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {section.items.map((item) => {
                const isActive = location.pathname.startsWith(item.to)

                return (
                  <ListItem
                    key={item.to}
                    disablePadding
                    sx={{ display: 'block' }}
                  >
                    <Tooltip
                      title={!showLabels ? item.text : ''}
                      placement='right'
                      arrow
                    >
                      <ListItemButton
                        component={Link}
                        to={item.to}
                        selected={isActive}
                        onClick={() => {
                          if (isMobile) setMobileOpen(false)
                        }}
                        sx={{
                          minHeight: 44,
                          border: 'none',
                          background: '#F5F5F5',
                          margin: '0 auto',
                          justifyContent: showLabels ? 'initial' : 'center',
                          width: showLabels ? 'auto' : '56px',
                          borderRadius: '12px',
                          transition: 'background-color 0.2s ease',
                          '&.Mui-selected': {
                            backgroundColor: 'var(--grey-300)'
                          }
                        }}
                      >
                        <ListItemIcon
                          sx={{
                            minWidth: 0,
                            mr: showLabels ? 2 : 0,
                            justifyContent: 'center'
                          }}
                        >
                          <img
                            src={`/assets/${
                              isActive ? item.activeIcon : item.inactiveIcon
                            }`}
                            alt={`${item.text} icon`}
                            style={{
                              width: 24,
                              height: 24,
                              display: 'block'
                            }}
                          />
                        </ListItemIcon>

                        {showLabels && (
                          <ListItemText>
                            <Typography
                              variant='subtitle2'
                              color={
                                isActive
                                  ? 'var(--color-primary-black)'
                                  : 'var(--color-primary-light)'
                              }
                            >
                              {item.text}
                            </Typography>
                          </ListItemText>
                        )}

                        {item.tooltipContent && showLabels && (
                          <Tooltip
                            title={item.tooltipContent}
                            arrow
                            placement='top'
                          >
                            <HelpOutlineIcon
                              sx={{
                                color: isActive
                                  ? 'var(--color-primary-black)'
                                  : 'var(--color-primary-light)',
                                cursor: 'pointer'
                              }}
                              aria-hidden={false}
                              role='img'
                            />
                          </Tooltip>
                        )}
                      </ListItemButton>
                    </Tooltip>
                  </ListItem>
                )
              })}
            </Box>
          </List>
        ))}
      </Stack>
    ),
    [handleMobileToggle, isMobile, location.pathname, toggleDrawer]
  )

  const desktopExpandedWidth = 280
  const desktopCollapsedWidth = 116
  const drawerWidth = open ? desktopExpandedWidth : desktopCollapsedWidth

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : `${drawerWidth}px 1fr`,
        minHeight: '100vh',
        transition: isMobile ? undefined : 'grid-template-columns 300ms ease',
        overflowX: 'hidden'
      }}
    >
      <CssBaseline />

      {!isMobile && (
        <DesktopDrawer
          variant='permanent'
          open={open}
          sx={{
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
              transition: 'width 180ms ease'
            }
          }}
        >
          {renderDrawerContent(open)}
        </DesktopDrawer>
      )}

      {isMobile && (
        <MuiDrawer
          variant='temporary'
          open={mobileOpen}
          onClose={handleMobileToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: 280,
              padding: '0px 16px',
              boxSizing: 'border-box',
              border: 'none',
              backgroundColor: 'var(--grey-100)'
            }
          }}
        >
          {renderDrawerContent(true)}
        </MuiDrawer>
      )}

      <Box
        component='main'
        className={styles.outletRoot}
        sx={{
          width: '100%',
          minHeight: '100vh',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Topbar
          title={activeItem?.text ?? ''}
          icon={activeItem?.activeIcon ?? ''}
          rightSlot={
            isMobile ? (
              <IconButton
                onClick={handleMobileToggle}
                size='small'
                aria-label='open menu'
              >
                <img src='/assets/layout-navbar-expand.svg' alt='menu' />
              </IconButton>
            ) : undefined
          }
        />
        <MobileTopBar
          title={activeItem?.text ?? ''}
          icon={activeItem?.activeIcon ?? ''}
        />
        <Box
          className={styles.outletContainer}
          ref={outletRef}
          sx={{
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box',
            overflowX: 'hidden'
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}
