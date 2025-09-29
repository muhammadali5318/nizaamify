import React, { useState } from 'react'
import { Box, Stack, List, ListItemButton, Typography } from '@mui/material'
import styles from './settings.module.scss'
import { SETTINGS_MENU } from './setting-config'
import { MenuItem } from './type'
import SettingsWrapper from './component/SettingsWrapper'

const Settings: React.FC = () => {
  const [active, setActive] = useState<string>(SETTINGS_MENU[0].id)
  const activeItem: MenuItem | undefined = SETTINGS_MENU.find(
    (m) => m.id === active
  )
  const ActiveComponent = activeItem?.component ?? null

  return (
    <Box className={styles.settingsRoot}>
      <Stack
        // column only for xs (<600), row for sm and up (>=600)
        direction={{ xs: 'column', sm: 'row' }}
        spacing={3}
        alignItems='stretch'
      >
        {/* Menu area */}
        <Box
          sx={{
            // full width on xs so it sits above, fixed width on sm+
            width: { xs: '100%', sm: 180 },
            flex: { xs: '0 0 auto', sm: '0 0 180px' }
          }}
        >
          <List
            component='nav'
            aria-label='Settings menu'
            sx={{
              display: 'flex',
              // horizontally on xs (<600), vertically on sm+
              flexDirection: { xs: 'row', sm: 'column' },
              gap: '8px',
              overflowX: { xs: 'auto', sm: 'visible' },
              overflowY: { xs: 'hidden', sm: 'auto' },
              whiteSpace: { xs: 'nowrap', sm: 'normal' },
              px: { xs: 1, sm: 0 },
              WebkitOverflowScrolling: 'touch'
            }}
          >
            {SETTINGS_MENU.map((m) => (
              <ListItemButton
                key={m.id}
                selected={m.id === active}
                onClick={() => setActive(m.id)}
                aria-selected={m.id === active}
                sx={{
                  '&.Mui-selected': {
                    backgroundColor: 'action.selected',
                    color: 'black'
                  },
                  color: 'var(--color-primary-light)',
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
            ))}
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
