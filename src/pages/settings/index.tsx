// pages/Settings.tsx
import React, { useState } from 'react'
import { Box, Stack } from '@mui/material'
import styles from './settings.module.scss'
import { SETTINGS_MENU } from './setting-config'
import { MenuItem } from './type'
import { useAuth } from 'src/context/AuthProvider'
import { useFetchUserWithActivePracticeData } from 'src/hooks/useFetchUserWithActivePracticeData'
import SidebarTabs from 'src/components/SidebarTabs/SidebarTabs'
import PageHeader from 'src/components/page-header'
import { useActivePractice } from 'src/hooks/useActivePractice'

const Settings = () => {
  const { accessToken } = useAuth()
  const { isOnboardingCompleted } = useActivePractice()

  const { data: userData } = useFetchUserWithActivePracticeData(!!accessToken)

  const [active, setActive] = useState<string>(SETTINGS_MENU[0].id)
  const activeItem: MenuItem | undefined = SETTINGS_MENU.find(
    (m) => m.id === active
  )
  const ActiveComponent = activeItem?.component ?? null

  return (
    <Box className={styles.settingsRoot}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={3}
        alignItems='stretch'
      >
        {/* Sidebar / tabs */}
        <SidebarTabs
          menu={SETTINGS_MENU}
          activeId={active}
          onChange={(id: React.SetStateAction<string>) => setActive(id)}
          userData={userData}
          onboardingCompleted={isOnboardingCompleted}
        />

        {/* Content area */}
        <Box className={styles.settingsContent}>
          {activeItem && ActiveComponent ? (
            <>
              <PageHeader
                title={activeItem.title}
                description={activeItem.description}
                logo={activeItem.logo}
              />
              <ActiveComponent {...(activeItem.componentProps ?? {})} />
            </>
          ) : null}
        </Box>
      </Stack>
    </Box>
  )
}

export default Settings
