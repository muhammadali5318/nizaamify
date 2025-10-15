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
        showInviteTeamMember={false}
        imageSrc='/assets/permission-icon.svg'
        imageAlt='permission icon'
        title={activeItem?.title}
        subtitle={activeItem?.description}
      >
        <Box
          sx={{
            width: '100%',
            display: 'flex',
            gap: { xs: 1.5, sm: 3 },
            flexDirection: { xs: 'column', sm: 'row' },
            padding: { xs: '12px', sm: '21px 16px 16px 16px' },
            alignItems: 'flex-start'
          }}
        >
          <Box
            className='roles-permissions__sidebar'
            sx={{
              width: { xs: '100%', sm: 'auto' },
              flex: { xs: '0 0 100%', sm: '0 0 auto' },
              flexShrink: 0,
              overflowX: { xs: 'auto', sm: 'visible' },
              WebkitOverflowScrolling: 'touch',
              pb: { xs: 1, sm: 0 },
              alignSelf: 'flex-start'
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
              pt: { xs: 0.5, sm: 0 }
            }}
            className='roles-permissions__content'
          >
            <SidebarContentWrapper
              title={activeItem?.title}
              description={activeItem?.description}
              logo='/assets/profile.svg'
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
