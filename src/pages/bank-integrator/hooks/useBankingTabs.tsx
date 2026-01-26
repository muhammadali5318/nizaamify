import React from 'react'
import { ReusableTabItem } from 'src/components/tabs/ReusableTabs'
import { bankingTabsData } from '../bank-integrator-config'
import ReconciliationTab from '../ReconciliationTab'
import BankIntegrator from '../BankIntegrator'

export default function useBankingTabs(): ReusableTabItem[] {
  return React.useMemo(() => {
    return bankingTabsData.map((t) => {
      let content: React.ReactNode = null
      let count: number | undefined = t.count
      let countTotal: number | undefined = t.countTotal

      switch (t.key) {
        case 0:
          content = <BankIntegrator />
          break

        case 1:
          // Pending Documents Tab → Use total from hook
          count = 12
          countTotal = 60
          content = <ReconciliationTab />
          break

        default:
          content = null
      }

      return {
        key: t.key,
        label: t.label,
        activeIcon: t.activeIcon,
        inactiveIcon: t.inactiveIcon,
        count,
        countTotal,
        content
      }
    })
  }, [])
}
