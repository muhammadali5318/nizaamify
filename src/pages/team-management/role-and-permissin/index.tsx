// pages/RolesPermissions.tsx
import React, { useState } from 'react'
import { Box } from '@mui/material'
import TeamManagementContentWrapper from '../components/TeamManagementContentWrapper'
import { TEAM_ROLES_MENU } from './role-and-permissions-config'
import SidebarTabs from 'src/components/SidebarTabs/SidebarTabs'
import SidebarContentWrapper from 'src/components/SidebarTabs/SidebarContentWrapper'

const RolesPermissions: React.FC = () => {
  const [active, setActive] = useState<string>(TEAM_ROLES_MENU[0].id)
  const activeItem: any | undefined = TEAM_ROLES_MENU.find(
    (m) => m.id === active
  )
  const ActiveComponent = activeItem?.component ?? null

  return (
    <Box>
      <TeamManagementContentWrapper
        imageSrc={activeItem?.imageSrc ?? '/assets/bg-black-clock-icon.svg'}
        imageAlt={activeItem?.imageAlt ?? 'role icon'}
        title={activeItem?.title ?? 'Roles & permissions'}
        subtitle={
          activeItem?.description ??
          'Manage role-based access control for your practice'
        }
      >
        <Box
          sx={{
            width: '100%',
            display: 'flex',
            gap: { xs: 1.5, md: 3 },
            flexDirection: { xs: 'column', md: 'row' },
            padding: { xs: '12px', md: '21px 16px 16px 16px' },
            alignItems: 'flex-start'
          }}
        >
          <Box
            className='roles-permissions__sidebar'
            sx={{
              width: { xs: '100%', md: 240 },
              minWidth: { md: 240 },
              flexShrink: 0,
              overflowX: { xs: 'auto', md: 'visible' },
              WebkitOverflowScrolling: 'touch',
              pb: { xs: 1, md: 0 }
            }}
          >
            <SidebarTabs
              menu={TEAM_ROLES_MENU}
              activeId={active}
              onChange={(id) => setActive(id)}
              header={'Roles'}
            />
          </Box>

          <Box
            component='main'
            sx={{
              flex: 1,
              width: '100%',
              minWidth: 0,
              pt: { xs: 0.5, md: 0 }
            }}
            className='roles-permissions__content'
          >
            <SidebarContentWrapper
              title={activeItem?.title}
              description={activeItem?.description}
              logo={activeItem?.logo}
              isDividerVisible={false}
            >
              {ActiveComponent ? (
                <ActiveComponent {...(activeItem?.componentProps ?? {})} />
              ) : null}
            </SidebarContentWrapper>
          </Box>
        </Box>
      </TeamManagementContentWrapper>
    </Box>
  )
}

export default RolesPermissions
