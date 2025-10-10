// FILE: src/hooks/useTeamManagementTabs.tsx
import React from 'react'
import { ReusableTabItem } from 'src/components/tabs/ReusableTabs'
import SentInvitations from '../invitatins'
import RolesPermissions from '../role-and-permissin'
import { tabsData } from '../team-management-config'
import TeamMembers from '../team-members'

export default function useTeamManagementTabs(
  onCountsUpdate?: (counts: {
    total_users: number
    active_users: number
    pending_invited_users: number
  }) => void
): ReusableTabItem[] {
  return React.useMemo(() => {
    return tabsData.map((t) => {
      let content: React.ReactNode = null

      switch (t.key) {
        case 0:
          content = <TeamMembers onCountsUpdate={onCountsUpdate} />
          break
        case 1:
          content = <SentInvitations />
          break
        case 2:
          content = <RolesPermissions />
          break
        default:
          content = null
      }

      return {
        key: t.key,
        label: t.label,
        activeIcon: t.activeIcon,
        inactiveIcon: t.inactiveIcon,
        content
      }
    })
  }, [onCountsUpdate])
}
