import { useEffect } from 'react'
import { Box, Stack } from '@mui/material'
import { useNavigate, useParams } from 'react-router'
import styles from './settings.module.scss'
import { SETTINGS_MENU } from './setting-config'
import { MenuItem } from './type'
import SidebarTabs from 'src/components/SidebarTabs/SidebarTabs'
import PageHeader from 'src/components/page-header'
import { useActivePractice } from 'src/hooks/useActivePractice'
import { paths } from 'src/paths'

const Settings = () => {
  const { isOnboardingCompleted } = useActivePractice()
  const navigate = useNavigate()
  const { tabId } = useParams<{ tabId?: string }>()
  const defaultTabId = SETTINGS_MENU[0].id

  const active = SETTINGS_MENU.some((item) => item.id === tabId)
    ? (tabId as string)
    : defaultTabId

  useEffect(() => {
    if (tabId === active) return
    navigate(paths.gotoSettingsTab(active), { replace: true })
  }, [active, navigate, tabId])

  const activeItem: MenuItem | undefined = SETTINGS_MENU.find(
    (m) => m.id === active
  )

  const ActiveComponent = activeItem?.component ?? null

  return (
    <Box className={styles.settingsRoot}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={{ xs: 2, sm: 3 }}
        alignItems='stretch'
      >
        <Box
          sx={{
            width: { xs: '100%', sm: 220 },
            flexShrink: 0
          }}
        >
          <SidebarTabs
            menu={SETTINGS_MENU}
            activeId={active}
            onChange={(id) => navigate(paths.gotoSettingsTab(id))}
            onboardingCompleted={isOnboardingCompleted}
          />
        </Box>

        <Box className={styles.settingsContent}>
          {activeItem && ActiveComponent ? (
            <>
              <PageHeader
                title={activeItem.title}
                description={activeItem.description}
                logo={activeItem.logo}
              />
              <Box sx={{ mt: 2 }}>
                <ActiveComponent {...(activeItem.componentProps ?? {})} />
              </Box>
            </>
          ) : null}
        </Box>
      </Stack>
    </Box>
  )
}

export default Settings
