// FILE: src/hooks/useTeamManagementTabs.tsx
import React from 'react'
import { ReusableTabItem } from 'src/components/tabs/ReusableTabs'
import { tabsData } from '../expense-breakdown-config'
import ProfitLossTab from '../ProfitLossTab'
import WaterfallChart from '../WaterfallChart'

export default function usePLTabs(): ReusableTabItem[] {
  return React.useMemo(() => {
    return tabsData.map((t) => {
      let content: React.ReactNode = null

      switch (t.key) {
        case 0:
          content = <ProfitLossTab />
          break
        case 1:
          content = <WaterfallChart />
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
  }, [])
}
