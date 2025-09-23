import * as React from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { useAuth0 } from '@auth0/auth0-react'
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
import { FormControl, Select, Stack, Tooltip, Typography } from '@mui/material'
import Topbar from './components/Topbar'
import { Drawer, MenuItemData, menuSections } from './applayout-config'
import { useFeatureFlags } from '../../hooks/useFeatureFlags'
import { useFeatureFlagContext } from '../../context/FeatureFlagProvider'

export default function AppLayout() {
  const { user } = useAuth0()
  const location = useLocation()
  const { userContext } = useFeatureFlagContext()
  const { isModuleEnabled, getDisabledReason } = useFeatureFlags(userContext)

  // Initialize from localStorage
  const [open, setOpen] = React.useState<boolean>(() => {
    const stored = localStorage.getItem('drawerOpen')
    return stored ? JSON.parse(stored) : true
  })
  const [activeItem, setActiveItem] = React.useState<MenuItemData | null>(null)

  // Toggle drawer & persist to localStorage
  const toggleDrawer = () => {
    setOpen((prev) => {
      const newState = !prev
      localStorage.setItem('drawerOpen', JSON.stringify(newState))
      return newState
    })
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

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <CssBaseline />

      {/* Sidebar Drawer */}
      <Drawer variant='permanent' open={open}>
        <Stack spacing={2}>
          {/* Sidebar Header */}
          <Box
            className={styles.toolbarHeader}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: open ? 'space-between' : 'center'
            }}
          >
            {open && <img src='/assets/monai-logo.svg' alt='monai icon' />}
            <IconButton
              onClick={toggleDrawer}
              className={styles.toggleBtn}
              sx={{ p: '0px 16px' }}
            >
              <img
                src={`/assets/${open ? 'layout-navbar-collapse.svg' : 'layout-navbar-expand.svg'}`}
                alt='collapse icon'
              />
            </IconButton>
          </Box>

          {/* Practice Selector */}
          <Box
            className={styles.practiceSelector}
            sx={{ display: 'flex', alignItems: 'center' }}
          >
            {/* Practice Icon */}
            <img src='/assets/practice-selector.svg' alt='practice selector' />
            <FormControl className={styles.muiSelectForm} fullWidth>
              <Select
                defaultValue={user?.organizations_with_roles[0].organization}
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
                    sx={{ display: open ? 'inline' : 'none' }}
                  >
                    {selected}
                  </Typography>
                )}
              >
                {/* <MenuItem value='practice1'>
                  <Typography variant='subtitle2'></Typography>
                </MenuItem> */}
              </Select>
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
                    textAlign: open ? 'left' : 'center',
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
                          !open
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
                              ? () => setActiveItem(item)
                              : undefined
                          }
                          disabled={!moduleEnabled}
                          sx={{
                            minHeight: 44,
                            margin: '0 auto',
                            justifyContent: open ? 'initial' : 'center',
                            width: open ? 'auto' : '56px',
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
                              mr: open ? 2 : 0,
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
                                filter: moduleEnabled
                                  ? 'none'
                                  : 'grayscale(100%)'
                              }}
                            />
                          </ListItemIcon>
                          {open && (
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
      </Drawer>

      {/* Main Content */}
      <Box component='main' className={styles.outletRoot}>
        <Topbar
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
