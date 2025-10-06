import React from 'react'
import styles from './teamManagement.module.scss'
import { Box, Tabs, Tab } from '@mui/material'
import { styled } from '@mui/material/styles'
import ModuleHeader from 'src/components/moduleHeader'
import StatsCard from 'src/components/team-management/StatsCard'
import SentInvitations from './invitatins'
import RolesPermissions from './role-and-permissin'
import { TabKey, tabsData } from './team-management-config'
import TeamMembers from './team-members'

function a11yProps(index: number) {
  return {
    id: `team-tab-${index}`,
    'aria-controls': `team-tabpanel-${index}`
  }
}

const TabPanel: React.FC<{
  value: TabKey
  index: TabKey
  children?: React.ReactNode
}> = ({ value, index, children }) => {
  return (
    <div
      role='tabpanel'
      hidden={value !== index}
      id={`team-tabpanel-${index}`}
      aria-labelledby={`team-tab-${index}`}
    >
      {value === index && <Box sx={{ mt: 2 }}>{children}</Box>}
    </div>
  )
}

const CenteredTab = styled(Tab)(() => ({
  textTransform: 'none',
  alignItems: 'center',
  gap: 1,

  minHeight: 42,

  '& .MuiTab-iconWrapper': {
    minWidth: 20,
    height: 20,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
    verticalAlign: 'middle'
  },

  '&.Mui-selected': {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: '12px',
    border: '1px solid var(--grey-300, #E0E0E0)',
    background: 'var(--grey-200, #EEE)',
    minHeight: 42
  }
}))

const TeamManagement: React.FC = () => {
  const [tab, setTab] = React.useState<TabKey>(0)

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTab(newValue as TabKey)
  }

  return (
    <Box className={styles.teamManagementRoot}>
      <ModuleHeader
        avatarSrc='/assets/team-management.svg'
        heading='Grayford practice management'
        subheading='Manage your practice team members, roles, and permissions'
      />

      <Box className={styles.statsCardRoot}>
        <StatsCard iconSrc='team-member.svg' label='Team Members' value='03' />
        <StatsCard
          iconSrc='active-member.svg'
          label='Active members'
          value='03'
        />
        <StatsCard
          iconSrc='pending-member.svg'
          label='Pending invites'
          value='03'
        />
      </Box>

      <Box
        sx={{
          width: '100%'
        }}
      >
        <Tabs
          value={tab}
          onChange={handleTabChange}
          aria-label='Team management tabs'
          variant='scrollable'
          scrollButtons='auto'
          textColor='primary'
          indicatorColor='primary'
          slotProps={{
            indicator: {
              style: { display: 'none' }
            }
          }}
        >
          {tabsData.map((t) => (
            <CenteredTab
              key={t.key}
              label={t.label}
              icon={
                <img
                  src={tab === t.key ? t.activeIcon : t.inactiveIcon}
                  alt={`${t.label} icon`}
                />
              }
              iconPosition='start'
              {...a11yProps(t.key)}
            />
          ))}
        </Tabs>

        <TabPanel value={tab} index={0}>
          <TeamMembers />
        </TabPanel>
        <TabPanel value={tab} index={1}>
          <SentInvitations />
        </TabPanel>
        <TabPanel value={tab} index={2}>
          <RolesPermissions />
        </TabPanel>
      </Box>
    </Box>
  )
}

export default TeamManagement
