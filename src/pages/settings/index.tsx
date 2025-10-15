// pages/Settings.tsx
import React, { useState } from 'react'
import { Box, Stack } from '@mui/material'
import styles from './settings.module.scss'
import { SETTINGS_MENU } from './setting-config'
import { MenuItem } from './type'
import { FEATURE_RULE_IDS } from 'src/constants/feature-rules'
import { useFeatureRule } from 'src/hooks/useFeatureRule'
import { useAuth } from 'src/context/AuthProvider'
import { useFetchUserWithActivePracticeData } from 'src/hooks/useFetchUserWithActivePracticeData'
import SidebarTabs from 'src/components/SidebarTabs/SidebarTabs'
import SidebarContentWrapper from 'src/components/SidebarTabs/SidebarContentWrapper'

const Settings = () => {
  const { accessToken } = useAuth()
  const { isEnabled: onboardingCompleted } = useFeatureRule(
    FEATURE_RULE_IDS.ONBOARDING_COMPLETED
  )

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
          onboardingCompleted={onboardingCompleted}
        />

        {/* Content area */}
        <Box className={styles.settingsContent}>
          {activeItem && ActiveComponent ? (
            <SidebarContentWrapper
              title={activeItem.title}
              description={activeItem.description}
              logo={activeItem.logo}
            >
              <ActiveComponent {...(activeItem.componentProps ?? {})} />
            </SidebarContentWrapper>
          ) : null}
        </Box>
      </Stack>
    </Box>
  )
}

export default Settings
