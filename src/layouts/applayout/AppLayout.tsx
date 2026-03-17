import * as React from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import CssBaseline from '@mui/material/CssBaseline'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import ListSubheader from '@mui/material/ListSubheader'
import styles from './AppLayout.module.scss'
import Box from '@mui/material/Box'
import { Stack, Tooltip, Typography, useMediaQuery } from '@mui/material'
import Topbar from './components/Topbar'
import MuiDrawer from '@mui/material/Drawer'
import {
  Drawer as DesktopDrawer,
  evaluateModuleStateWithReason,
  MenuItemData,
  menuSections
} from './applayout-config'
import MobileTopBar from './components/MobileTopbar'
import PracticeSelector from './components/PracticeSelector'
import { useSelector } from 'react-redux'
import { selectPermissionsByCategory } from 'src/store/slices/userDetailsInActivePracticeSlice'
import { useActivePractice } from 'src/hooks/useActivePractice'
import { useEffect, useRef, useCallback } from 'react'
import { useUserDetailsInActivePractice } from 'src/hooks/useUserDetailsInActivePractice'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'

export default function AppLayout() {
  const location = useLocation()

  const permissionsByCategory = useSelector(selectPermissionsByCategory)
  const { isOnboardingCompleted, isActivePracticeSubscribed } =
    useActivePractice()

  const { userDetails } = useUserDetailsInActivePractice() // <-- hook at top-level

  const isMobile = useMediaQuery('(max-width:768px)')
  const isCollapsedBreakpoint = useMediaQuery('(max-width:1024px)')

  // SSR-safe lazy init for drawerOpen
  const [open, setOpen] = React.useState<boolean>(() => {
    try {
      if (typeof window === 'undefined') return true
      const stored = localStorage.getItem('drawerOpen')
      return stored ? JSON.parse(stored) : true
    } catch {
      return true
    }
  })

  // Mobile only state
  const [mobileOpen, setMobileOpen] = React.useState(false)

  const [activeItem, setActiveItem] = React.useState<MenuItemData | null>(null)

  useEffect(() => {
    const stored =
      typeof window !== 'undefined' ? localStorage.getItem('drawerOpen') : null
    const parsed = stored ? JSON.parse(stored) : true

    if (isCollapsedBreakpoint) {
      setOpen(false)
    } else {
      setOpen(parsed)
    }
  }, [isCollapsedBreakpoint])

  // Toggle desktop drawer & persist
  const toggleDrawer = useCallback(() => {
    setOpen((prev) => {
      const newState = !prev
      try {
        localStorage.setItem('drawerOpen', JSON.stringify(newState))
      } catch {
        // ignore storage errors
      }
      return newState
    })
  }, [])

  // Toggle mobile drawer
  const handleMobileToggle = useCallback(() => {
    setMobileOpen((prev) => !prev)
  }, [])

  /**
   * SCROLL / LAYOUT helpers
   */
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
      if (isScrollable) return cur
      cur = cur.parentElement
    }
    return window
  }

  const outletRef = useRef<HTMLDivElement | null>(null)

  // Track active item based on route
  useEffect(() => {
    for (const section of menuSections) {
      const found = section.items.find((item) =>
        location.pathname.startsWith(item.to)
      )
      if (found) {
        setActiveItem(found)
        break
      }
    }
  }, [location.pathname])

  // disable native history scroll restoration (we manage it manually)
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
  }, [])

  // Reset scroll on route change
  useEffect(() => {
    const scrollParent = findScrollParent(outletRef.current)

    const doScrollTop = () => {
      if (scrollParent === window) {
        window.scrollTo(0, 0)
      } else {
        ;(scrollParent as HTMLElement).scrollTop = 0
      }
    }

    doScrollTop()

    requestAnimationFrame(() => {
      doScrollTop()
      requestAnimationFrame(() => {
        doScrollTop()
      })
    })

    const t = window.setTimeout(doScrollTop, 60)

    return () => {
      window.clearTimeout(t)
    }
  }, [location.pathname])

  // memoized drawer content renderer — no hooks inside it
  const renderDrawerContent = useCallback(
    (showLabels: boolean) => {
      const featureContext = {
        onboardingCompleted: isOnboardingCompleted,
        subscriptionActive: isActivePracticeSubscribed,
        role: userDetails?.user_role
      }

      return (
        <Stack spacing={2}>
          {/* Sidebar Header */}
          <Box
            className={styles.toolbarHeader}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: showLabels ? 'space-between' : 'center'
            }}
          >
            {showLabels && (
              <img src='/assets/monai-logo.svg' alt='monai icon' />
            )}
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

          {/* Practice Selector */}
          <PracticeSelector />

          {/* Menu Sections */}
          {menuSections?.map((section) => {
            const hasVisibleItem = section.items.some((item) => {
              const { state } = evaluateModuleStateWithReason(
                item.moduleId,
                permissionsByCategory || {},
                featureContext
              )
              return state !== 'hidden'
            })
            if (!hasVisibleItem) return null

            return (
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
                <Box
                  sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}
                >
                  {section.items.map((item) => {
                    const isActive = location.pathname.startsWith(item.to)
                    const { state, reason } = evaluateModuleStateWithReason(
                      item.moduleId,
                      permissionsByCategory || {},
                      featureContext
                    )

                    if (state === 'hidden') return null

                    if (state === 'disabled') {
                      return (
                        <ListItem
                          key={item.to}
                          disablePadding
                          sx={{ display: 'block' }}
                        >
                          <Tooltip
                            title={reason || `${item.text} is disabled`}
                            placement='right'
                            arrow
                          >
                            <ListItemButton
                              component='div'
                              selected={false}
                              disabled
                              sx={{
                                minHeight: 44,
                                margin: '0 auto',
                                justifyContent: showLabels
                                  ? 'initial'
                                  : 'center',
                                width: showLabels ? 'auto' : '56px',
                                borderRadius: '12px',
                                transition: 'background-color 0.2s ease',
                                opacity: 0.5,
                                cursor: 'not-allowed',
                                '&.Mui-selected': {
                                  backgroundColor: 'var(--grey-300)'
                                },
                                '&.Mui-disabled': { opacity: 0.5 }
                              }}
                              aria-disabled
                            >
                              <ListItemIcon
                                sx={{
                                  minWidth: 0,
                                  mr: showLabels ? 2 : 0,
                                  justifyContent: 'center',
                                  opacity: 0.5
                                }}
                              >
                                <img
                                  src={`/assets/${isActive ? item.activeIcon : item.inactiveIcon}`}
                                  alt={`${item.text} icon`}
                                  style={{
                                    width: 24,
                                    height: 24,
                                    display: 'block',
                                    filter: 'grayscale(100%)'
                                  }}
                                />
                              </ListItemIcon>
                              {showLabels && (
                                <ListItemText>
                                  <Typography
                                    variant='subtitle2'
                                    color={'var(--color-primary-light)'}
                                  >
                                    {item.text}
                                  </Typography>
                                </ListItemText>
                              )}
                            </ListItemButton>
                          </Tooltip>
                        </ListItem>
                      )
                    }

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
                              setActiveItem(item)
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
                              opacity: 1,
                              cursor: 'pointer',
                              '&.Mui-selected': {
                                backgroundColor: 'var(--grey-300)'
                              },
                              '&.Mui-disabled': { opacity: 0.5 }
                            }}
                          >
                            <ListItemIcon
                              sx={{
                                minWidth: 0,
                                mr: showLabels ? 2 : 0,
                                justifyContent: 'center',
                                opacity: 1
                              }}
                            >
                              <img
                                src={`/assets/${isActive ? item.activeIcon : item.inactiveIcon}`}
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

                            {item?.tooltipContent && showLabels && (
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
            )
          })}
        </Stack>
      )
    },
    [
      isMobile,
      isOnboardingCompleted,
      isActivePracticeSubscribed,
      permissionsByCategory,
      userDetails,
      handleMobileToggle,
      toggleDrawer,
      location.pathname
    ]
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

      {/* Desktop Drawer (styled) */}
      {!isMobile && (
        // ensure the Drawer paper width matches drawerWidth
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

      {/* Mobile Drawer (native temporary) */}
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

      {/* Main Content (second grid column) */}
      <Box
        component='main'
        className={styles.outletRoot}
        sx={{
          // make sure main occupies the second column and reflows
          width: '100%',
          minHeight: '100vh',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Topbar
          title={activeItem?.text || ''}
          icon={activeItem?.activeIcon || ''}
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
          title={activeItem?.text || ''}
          icon={activeItem?.activeIcon || ''}
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
