import { useState } from 'react'
import { Box, Stack, List, ListItemButton, Typography } from '@mui/material'
import styles from './settings.module.scss'
import { SETTINGS_MENU } from './setting-config'
import { MenuItem } from './type'
import SettingsWrapper from './component/SettingsWrapper'
import { FEATURE_RULE_IDS } from 'src/constants/feature-rules'
import { useFeatureRule } from 'src/hooks/useFeatureRule'
import { useAuth } from 'src/context/AuthProvider'
import { useFetchUserWithActivePracticeData } from 'src/hooks/useFetchUserWithActivePracticeData'
import { isPracticeManager } from 'src/utils/helper'

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
        {/* Menu area */}
        <Box
          sx={{
            width: { xs: '100%', sm: 180 },
            flex: { xs: '0 0 auto', sm: '0 0 180px' }
          }}
        >
          <List component='nav' aria-label='Settings menu'>
            {SETTINGS_MENU.map((m) => {
              const isPracticeTab = m.id === 'practice'

              if (isPracticeTab && isPracticeManager(userData)) {
                return null
              }

              const isDisabled = isPracticeTab && !onboardingCompleted

              return (
                <ListItemButton
                  key={m.id}
                  selected={m.id === active}
                  onClick={() => !isDisabled && setActive(m.id)}
                  aria-selected={m.id === active}
                  disabled={isDisabled}
                  sx={{
                    '&.Mui-selected': {
                      backgroundColor: 'action.selected',
                      color: 'black'
                    },
                    color: isDisabled
                      ? 'text.disabled'
                      : 'var(--color-primary-light)',
                    textTransform: 'none',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '8px 12px',
                    display: { xs: 'inline-flex', sm: 'flex' },
                    minWidth: { xs: 96, sm: 'auto' },
                    mr: { xs: 1, sm: 0 }
                  }}
                >
                  <Typography
                    className='font-weight--700'
                    variant='subtitle2'
                    py={0.2}
                  >
                    {m.label}
                  </Typography>
                </ListItemButton>
              )
            })}
          </List>
        </Box>

        <Box className={styles.settingsContent}>
          {activeItem && ActiveComponent ? (
            <SettingsWrapper
              title={activeItem.title}
              description={activeItem.description}
              logo={activeItem.logo}
            >
              <ActiveComponent {...(activeItem.componentProps ?? {})} />
            </SettingsWrapper>
          ) : null}
        </Box>
      </Stack>
    </Box>
  )
}

export default Settings
