import { Box } from '@mui/material'
import ModuleHeader from 'src/components/module-header'
import { ReusableTabs } from 'src/components/tabs'
import { tabsData } from '../team-management/team-management-config'
import styles from './bankIntegrator.module.scss'
import useBankingTabs from './hooks/useBankingTabs'

const BankingAggregator = () => {
  const tabs = useBankingTabs()

  return (
    <Box className={styles.bankingRoot}>
      <ModuleHeader
        avatarSrc='/assets/bank-module.svg'
        heading={'Bank Aggregator'}
        subheading='Manage your connected bank accounts and reconcile transactions'
      />

      <ReusableTabs tabs={tabs} initialTab={tabsData[0].key} />
    </Box>
  )
}

export default BankingAggregator
