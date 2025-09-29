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
  MenuItem,
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
import { useFeatureFlagContext } from '../../context/FeatureFlagProvider'
import MobileTopBar from './components/MobileTopbar'
import { useInitialData } from 'src/hooks/useFetchInitialData'
import { useAuth } from 'src/context/AuthProvider'
import { FEATURE_RULE_IDS } from 'src/constants/feature-rules'
import { featureFlagConfig } from 'src/config/feature-flag-config'
import { FeatureFlagService } from 'src/services/FeatureFlagService'

type ModuleRenderState = 'hidden' | 'disabled' | 'enabled'

function evaluateModuleStateWithReason(
  moduleId: string,
  userContext: Record<string, any>
): { state: ModuleRenderState; reason?: string } {
  const moduleConfig = featureFlagConfig.modules.find(
    (m) => m.id === (moduleId as any)
  )
  if (!moduleConfig) return { state: 'enabled' }

  const requiredRules = moduleConfig.requiredRules || []
  let sawDisable = false
  let reason: string | undefined

  for (const ruleId of requiredRules) {
    const ok = FeatureFlagService.evaluateRule(ruleId, userContext)
    if (ok) continue

    const rule = FeatureFlagService.findRule(ruleId)
    const visibility = (rule as any)?.visibility as
      | 'hide'
      | 'disable'
      | undefined

    if (visibility === 'hide') {
      reason =
        moduleConfig.disabledMessage ||
        rule?.description ||
        `${moduleConfig.name} is disabled`
      return { state: 'hidden', reason }
    }
    if (visibility === 'disable') {
      reason =
        moduleConfig.disabledMessage ||
        rule?.description ||
        `${moduleConfig.name} is disabled`
      sawDisable = true
      continue
    }

    if (ruleId === FEATURE_RULE_IDS.NOT_MANAGER) {
      reason =
        moduleConfig.disabledMessage ||
        rule?.description ||
        `${moduleConfig.name} is not available for your role`
      return { state: 'hidden', reason }
    }
    if (ruleId === FEATURE_RULE_IDS.ONBOARDING_COMPLETED) {
      reason = 'Complete onboarding to access this module'
      sawDisable = true
      continue
    }

    reason =
      moduleConfig.disabledMessage ||
      rule?.description ||
      `${moduleConfig.name} is disabled`
    sawDisable = true
  }

  return { state: sawDisable ? 'disabled' : 'enabled', reason }
}

export default function AppLayout() {
  const location = useLocation()
  const { userContext } = useFeatureFlagContext()
  const { accessToken } = useAuth()
  const { data: practiceData } = useInitialData(!!accessToken)
  const [selectedPractice, setSelectedPractice] = React.useState<string>('')

  React.useEffect(() => {
    if (practiceData?.practice_name) {
      setSelectedPractice(practiceData.practice_name)
    }
  }, [practiceData])

  const isMobile = useMediaQuery('(max-width:768px)')
  const isCollapsedBreakpoint = useMediaQuery('(max-width:1024px)')

  const [open, setOpen] = React.useState<boolean>(() => {
    const stored = localStorage.getItem('drawerOpen')
    return stored ? JSON.parse(stored) : true
  })

  // Mobile only state
  const [mobileOpen, setMobileOpen] = React.useState(false)

  const [activeItem, setActiveItem] = React.useState<MenuItemData | null>(null)

  React.useEffect(() => {
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
            value={selectedPractice}
            onChange={(e) => setSelectedPractice(e.target.value)}
            displayEmpty
            className={styles.muiSelect}
            sx={{
              borderRadius: '16px',
              pl: 2,
              '& .MuiOutlinedInput-notchedOutline': { borderRadius: '16px' },
              '& .MuiSelect-icon': { right: 0 }
            }}
            renderValue={(selected) => (
              <Typography
                variant='subtitle2'
                sx={{ display: showLabels ? 'inline' : 'none' }}
              >
                {selected || 'Select practice'}
              </Typography>
            )}
          >
            {practiceData && (
              <MenuItem value={practiceData.practice_name}>
                {practiceData.practice_name}
              </MenuItem>
            )}
          </Select>
        </FormControl>
      </Box>

      {/* Menu Sections */}
      {menuSections?.map((section) => {
        const hasVisibleItem = section.items.some((item) => {
          const { state } = evaluateModuleStateWithReason(
            item.moduleId,
            userContext || {}
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
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {section.items.map((item) => {
                const isActive = location.pathname.startsWith(item.to)
                const { state, reason } = evaluateModuleStateWithReason(
                  item.moduleId,
                  userContext || {}
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
                            style={{ width: 24, height: 24, display: 'block' }}
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
