import React, { useState, useMemo } from 'react'
import { ReusableTabItem } from 'src/components/tabs/ReusableTabs'
import { bankingTabsData } from '../bank-integrator-config'
import ReconciliationTab from '../ReconciliationTab'
import BankIntegrator from '../BankIntegrator'
import Transactions from '../components/transactions'
import { useActivePractice } from 'src/hooks/useActivePractice'
import TransactionsHistory from '../components/transactions-history'

export default function BankingTabsContainer(): ReusableTabItem[] {
  const { accountingBasis } = useActivePractice()
  const [totalTransactions, setTotalTransactions] = useState(0)
  const [transactionsWithInvoices, setTransactionsWithInvoices] = useState(0)
  const [transactionsWithoutInvoices, setTransactionsWithoutInvoices] =
    useState(0)

  const tabs = useMemo(() => {
    return bankingTabsData
      .filter((t) => !(accountingBasis === 'ACCRUAL' && t.key === 1))
      .map((t) => {
        let content: React.ReactNode = null
        let count = t.count
        let countTotal = t.countTotal

        switch (t.key) {
          case 0:
            content = <BankIntegrator />
            break

          case 2:
            count = transactionsWithInvoices
            countTotal = totalTransactions

            content = (
              <ReconciliationTab
                totalTransactions={totalTransactions}
                transactionsWithInvoices={transactionsWithInvoices}
                transactionsWithoutInvoices={transactionsWithoutInvoices}
                setTotalTransactions={setTotalTransactions}
                setTransactionsWithInvoices={setTransactionsWithInvoices}
                setTransactionsWithoutInvoices={setTransactionsWithoutInvoices}
              />
            )
            break

          case 1:
            content = <Transactions />
            break
          case 3:
            content = <TransactionsHistory />
            break
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
  }, [
    accountingBasis,
    totalTransactions,
    transactionsWithInvoices,
    transactionsWithoutInvoices
  ])

  return tabs
}
