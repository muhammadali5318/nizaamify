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
import { useEffect, useRef } from 'react'
import { useUserDetailsInActivePractice } from 'src/hooks/useUserDetailsInActivePractice'

export default function AppLayout() {
  const location = useLocation()

  const isMonaiAgentRoute = location.pathname.startsWith('/monai-agent')
  const permissionsByCategory = useSelector(selectPermissionsByCategory)
  const { isOnboardingCompleted, isActivePracticeSubscribed } =
    useActivePractice()

  const isMobile = useMediaQuery('(max-width:768px)')
  const isCollapsedBreakpoint = useMediaQuery('(max-width:1024px)')

  const [open, setOpen] = React.useState<boolean>(() => {
    const stored = localStorage.getItem('drawerOpen')
    return stored ? JSON.parse(stored) : true
  })

  // Mobile only state
  const [mobileOpen, setMobileOpen] = React.useState(false)

  const [activeItem, setActiveItem] = React.useState<MenuItemData | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('drawerOpen')
    const parsed = stored ? JSON.parse(stored) : true

    if (isCollapsedBreakpoint) {
      setOpen(false)
    } else {
      setOpen(parsed)
    }
  }, [isCollapsedBreakpoint])

  // Toggle desktop drawer & persist
  const toggleDrawer = () => {
    setOpen((prev) => {
      const newState = !prev
      localStorage.setItem('drawerOpen', JSON.stringify(newState))
      return newState
    })
  }

  // Toggle mobile drawer
  const handleMobileToggle = () => {
    setMobileOpen((prev) => !prev)
  }

  /**
   * SCROLL / LAYOUT helpers
   */

  // a small utility that climbs parents and finds the first scrollable element.
  function findScrollParent(el: HTMLElement | null): HTMLElement | Window {
    if (!el) return window
    let cur: HTMLElement | null = el
    while (cur) {
      const style = window.getComputedStyle(cur)
      const overflowY = style.overflowY
      const isScrollable =
        (overflowY === 'auto' || overflowY === 'scroll') &&
        cur.scrollHeight > cur.clientHeight
      if (isScrollable) return cur
      cur = cur.parentElement
    }
    return window
  }

  // ref for the outlet container (the element we want to be the scroller)
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
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual'
    }
  }, [])

  // Reset scroll on route change (robust: immediate, rAF, timeout)
  useEffect(() => {
    const scrollParent = findScrollParent(outletRef.current)

    const doScrollTop = () => {
      if (scrollParent === window) {
        window.scrollTo(0, 0)
      } else {
        ;(scrollParent as HTMLElement).scrollTop = 0
      }
    }

    // try immediately
    doScrollTop()

    // ensure after paint/layout
    requestAnimationFrame(() => {
      doScrollTop()
      // second rAF to be extra robust for async layout
      requestAnimationFrame(() => {
        doScrollTop()
      })
    })

    // micro fallback
    const t = window.setTimeout(doScrollTop, 60)

    return () => {
      window.clearTimeout(t)
    }
    // we want to run on each navigation
  }, [location.pathname])

  const renderDrawerContent = (showLabels: boolean) => {
    const { userDetails } = useUserDetailsInActivePractice()
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
          {showLabels && <img src='/assets/monai-logo.svg' alt='monai icon' />}
          <IconButton
            onClick={isMobile ? handleMobileToggle : toggleDrawer}
            className={styles.toggleBtn}
            sx={{ p: '0px 16px' }}
          >
            <img
              src={`/assets/${
                showLabels
                  ? 'layout-navbar-collapse.svg'
                  : 'layout-navbar-expand.svg'
              }`}
              alt='collapse icon'
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

                  const showTooltip = !showLabels

                  if (state === 'disabled') {
                    return (
                      <ListItem
                        key={item.text}
                        disablePadding
                        sx={{ display: 'block' }}
                      >
                        <Tooltip
                          title={
                            showTooltip
                              ? reason || `${item.text} is disabled`
                              : reason || `${item.text} is disabled`
                          }
                          placement='right'
                          arrow
                        >
                          <ListItemButton
                            component={'div'}
                            selected={false}
                            disabled
                            sx={{
                              minHeight: 44,
                              margin: '0 auto',
                              justifyContent: showLabels ? 'initial' : 'center',
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
                      key={item.text}
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
                            border:
                              isActive && isMonaiAgentRoute
                                ? '2px solid transparent'
                                : 'none',
                            background:
                              isActive && isMonaiAgentRoute
                                ? `
      linear-gradient(var(--grey-100), var(--grey-100)) padding-box,
      linear-gradient(90deg, #000000, #C27961, #FFEA00, #00FF04,#00B2FF,#9D00FF,#FF0080) border-box
    `
                                : '#F5F5F5',
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
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <CssBaseline />

      {/* Desktop Drawer (styled) */}
      {!isMobile && (
        <DesktopDrawer variant='permanent' open={open}>
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

      {/* Main Content */}
      <Box component='main' className={styles.outletRoot}>
        <Topbar
          title={activeItem?.text || ''}
          icon={activeItem?.activeIcon || ''}
          // show mobile menu button on mobile
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
        <Box className={styles.outletContainer} ref={outletRef}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}
