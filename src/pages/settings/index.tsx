import { useState } from 'react'
import { Box, Stack } from '@mui/material'
import styles from './settings.module.scss'
import { SETTINGS_MENU } from './setting-config'
import { MenuItem } from './type'
import SidebarTabs from 'src/components/SidebarTabs/SidebarTabs'
import PageHeader from 'src/components/page-header'
import { useActivePractice } from 'src/hooks/useActivePractice'

const Settings = () => {
  const { isOnboardingCompleted } = useActivePractice()
  const [active, setActive] = useState<string>(SETTINGS_MENU[0].id)

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
            onChange={setActive}
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
