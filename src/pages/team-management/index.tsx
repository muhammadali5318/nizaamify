// FILE: src/pages/TeamManagement.tsx
import React, { useCallback, useState } from 'react'
import { Box } from '@mui/material'
import styles from './teamManagement.module.scss'
import ModuleHeader from 'src/components/moduleHeader'
import StatsCard from 'src/components/team-management/StatsCard'
import useTeamManagementTabs from './hooks/useTeamManagementTabs'
import { ReusableTabs } from 'src/components/tabs'
import { tabsData } from './team-management-config'

const TeamManagement: React.FC = () => {
  const [teamCounts, setTeamCounts] = useState({
    total_users: 0,
    active_users: 0,
    pending_invited_users: 0
  })

  const handleCountsUpdate = useCallback(
    (counts: typeof teamCounts) => {
      setTeamCounts(counts)
    },
    [setTeamCounts]
  )

  const tabs = useTeamManagementTabs(handleCountsUpdate)
  return (
    <Box className={styles.teamManagementRoot}>
      <ModuleHeader
        avatarSrc='/assets/team-management.svg'
        heading='Grayford practice management'
        subheading='Manage your practice team members, roles, and permissions'
      />

      <Box className={styles.statsCardRoot}>
        <StatsCard
          iconSrc='team-member.svg'
          label='Team Members'
          value={teamCounts?.total_users}
        />
        <StatsCard
          iconSrc='active-member.svg'
          label='Active members'
          value={teamCounts?.active_users}
        />
        <StatsCard
          iconSrc='pending-member.svg'
          label='Pending invites'
          value={teamCounts?.pending_invited_users}
        />
      </Box>

      <ReusableTabs tabs={tabs} initialTab={tabsData[0].key} />
    </Box>
  )
}

export default TeamManagement
