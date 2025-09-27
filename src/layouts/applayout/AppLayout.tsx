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
import {
  FormControl,
  Select,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery
} from '@mui/material'
import Topbar from './components/Topbar'
import MuiDrawer from '@mui/material/Drawer'
import {
  Drawer as DesktopDrawer,
  MenuItemData,
  menuSections
} from './applayout-config'
import { useFeatureFlags } from '../../hooks/useFeatureFlags'
import { useFeatureFlagContext } from '../../context/FeatureFlagProvider'
import MobileTopBar from './components/MobileTopbar'
import { useInitialData } from 'src/hooks/useFetchInitialData'
import { useAuth } from 'src/context/AuthProvider'

export default function AppLayout() {
  const location = useLocation()
  const { userContext } = useFeatureFlagContext()
  const { isModuleEnabled, getDisabledReason } = useFeatureFlags(userContext)
  const { accessToken } = useAuth()
  const { data: practiceData } = useInitialData(!!accessToken)

  // eslint-disable-next-line no-console
  console.log(practiceData)

  const isMobile = useMediaQuery('(max-width:768px)')

  // Desktop open state persisted to localStorage
  const [open, setOpen] = React.useState<boolean>(() => {
    const stored = localStorage.getItem('drawerOpen')
    return stored ? JSON.parse(stored) : true
  })

  // Mobile only state
  const [mobileOpen, setMobileOpen] = React.useState(false)

  const [activeItem, setActiveItem] = React.useState<MenuItemData | null>(null)

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

  // Track active item based on route
  React.useEffect(() => {
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

  // Reusable drawer content
  const renderDrawerContent = (showLabels: boolean) => (
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
      <Box
        className={styles.practiceSelector}
        sx={{ display: 'flex', alignItems: 'center' }}
      >
        <img src='/assets/practice-selector.svg' alt='practice selector' />
        <FormControl className={styles.muiSelectForm} fullWidth>
          <Select
            defaultValue={practiceData?.practice_name}
            displayEmpty
            className={styles.muiSelect}
            sx={{
              borderRadius: '16px',
              pl: 2,
              '& .MuiOutlinedInput-notchedOutline': {
                borderRadius: '16px'
              },
              '& .MuiSelect-icon': {
                right: 0
              }
            }}
            renderValue={(selected) => (
              <Typography
                variant='subtitle2'
                sx={{ display: showLabels ? 'inline' : 'none' }}
              >
                {selected as string}
              </Typography>
            )}
          />
        </FormControl>
      </Box>

      {/* Menu Sections */}
      {menuSections?.map((section) => (
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
              const moduleEnabled = isModuleEnabled(item.moduleId)
              const disabledReason = getDisabledReason(item.moduleId)

              return (
                <ListItem
                  key={item.text}
                  disablePadding
                  sx={{ display: 'block' }}
                >
                  <Tooltip
                    title={
                      !showLabels
                        ? moduleEnabled
                          ? item.text
                          : disabledReason || `${item.text} is disabled`
                        : moduleEnabled
                          ? ''
                          : disabledReason || `${item.text} is disabled`
                    }
                    placement='right'
                    arrow
                  >
                    <ListItemButton
                      component={moduleEnabled ? Link : 'div'}
                      to={moduleEnabled ? item.to : undefined}
                      selected={isActive && moduleEnabled}
                      onClick={
                        moduleEnabled
                          ? () => {
                              setActiveItem(item)
                              if (isMobile) setMobileOpen(false)
                            }
                          : undefined
                      }
                      disabled={!moduleEnabled}
                      sx={{
                        minHeight: 44,
                        margin: '0 auto',
                        justifyContent: showLabels ? 'initial' : 'center',
                        width: showLabels ? 'auto' : '56px',
                        borderRadius: '12px',
                        transition: 'background-color 0.2s ease',
                        opacity: moduleEnabled ? 1 : 0.5,
                        cursor: moduleEnabled ? 'pointer' : 'not-allowed',
                        '&.Mui-selected': {
                          backgroundColor: 'var(--grey-300)'
                        },
                        '&.Mui-disabled': {
                          opacity: 0.5
                        }
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          minWidth: 0,
                          mr: showLabels ? 2 : 0,
                          justifyContent: 'center',
                          opacity: moduleEnabled ? 1 : 0.5
                        }}
                      >
                        <img
                          src={`/assets/${isActive && moduleEnabled ? item.activeIcon : item.inactiveIcon}`}
                          alt={`${item.text} icon`}
                          style={{
                            width: 24,
                            height: 24,
                            display: 'block',
                            filter: moduleEnabled ? 'none' : 'grayscale(100%)'
                          }}
                        />
                      </ListItemIcon>
                      {showLabels && (
                        <ListItemText>
                          <Typography
                            variant='subtitle2'
                            color={
                              moduleEnabled
                                ? isActive
                                  ? 'var(--color-primary-black)'
                                  : 'var(--color-primary-light)'
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
      ))}
    </Stack>
  )

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
        <Box className={styles.outletContainer}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}
