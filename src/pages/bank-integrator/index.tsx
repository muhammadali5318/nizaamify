import { Box, Button } from '@mui/material'
import ModuleHeader from 'src/components/module-header'
import { ReusableTabs } from 'src/components/tabs'
import styles from './bankIntegrator.module.scss'
import useBankingTabs from './hooks/useBankingTabs'
import { useNavigate } from 'react-router'
import { paths } from 'src/paths'
import { useSelector } from 'react-redux'
import { selectActiveTab } from 'src/store/slices/bankIntegratorTabSlice'

const BankingAggregator = () => {
  const navigate = useNavigate()
  const tabs = useBankingTabs()
  const initalTab = useSelector(selectActiveTab)

  return (
    <Box className={styles.bankingRoot}>
      <Box
        width='100%'
        display='flex'
        flexDirection={{ xs: 'column', sm: 'row' }}
        justifyContent='space-between'
        alignItems={{ xs: 'stretch', sm: 'center' }}
        gap={2}
      >
        <ModuleHeader
          avatarSrc='/assets/bank-module.svg'
          heading='Bank Aggregator'
          subheading='Manage your connected bank accounts and reconcile transactions'
        />

        {initalTab !== 0 && (
          <Button
            variant='contained'
            onClick={() => navigate(paths.uploadBankStatement)}
            sx={{ width: { xs: 'auto', sm: 'auto' } }}
          >
            Upload statement
          </Button>
        )}
      </Box>

      <ReusableTabs tabs={tabs} initialTab={initalTab} setActiveKey={true} />
    </Box>
  )
}

export default BankingAggregator
