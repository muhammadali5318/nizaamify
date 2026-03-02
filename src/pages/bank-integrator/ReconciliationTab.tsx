import { Alert, Box, Stack, Typography } from '@mui/material'
import StatsCard from 'src/components/team-management/StatsCard'
import StatsChart from './components/stats-chart'
import ReconciliationContent from './components/recon-content'

type Props = {
  totalTransactions: number
  transactionsWithInvoices: number
  transactionsWithoutInvoices: number
  setTotalTransactions: React.Dispatch<React.SetStateAction<number>>
  setTransactionsWithInvoices: React.Dispatch<React.SetStateAction<number>>
  setTransactionsWithoutInvoices: React.Dispatch<React.SetStateAction<number>>
}

const ReconciliationTab = ({
  totalTransactions,
  transactionsWithInvoices,
  transactionsWithoutInvoices,
  setTotalTransactions,
  setTransactionsWithInvoices,
  setTransactionsWithoutInvoices
}: Props) => {
  const percentage =
    totalTransactions > 0
      ? Math.round((transactionsWithInvoices / totalTransactions) * 100)
      : 0

  return (
    <Stack spacing={2.5}>
      <Alert
        severity='info'
        className='alert-info-container'
        sx={{
          borderRadius: '16px',
          border: '1px solid var(--info-main, #0288D1)'
        }}
      >
        <Typography color='info.dark' fontWeight={700}>
          Keep your practice organized!
        </Typography>

        <Typography color='info.dark'>
          Upload invoices for your transactions to achieve verified status.
          You&apos;ve uploaded {transactionsWithInvoices} of{' '}
          {transactionsWithoutInvoices} invoices ({percentage}%). Upload{' '}
          {Math.max(transactionsWithoutInvoices - transactionsWithInvoices, 0)}{' '}
          more to get verified.
        </Typography>
      </Alert>

      <Box
        className='statsCardRoot'
        sx={{
          justifyContent: { xs: 'center', sm: 'center', md: 'flex-start' }
        }}
      >
        <StatsCard
          iconSrc='team-member.svg'
          label='Total Transactions'
          value={totalTransactions}
        />

        <StatsCard
          iconSrc='active-member.svg'
          label='With Invoices'
          value={transactionsWithInvoices}
        />

        <StatsCard
          iconSrc='pending-member.svg'
          label='Missing Invoices'
          value={transactionsWithoutInvoices}
        />

        <StatsChart
          value={percentage}
          transactionsWithInvoices={transactionsWithInvoices}
          transactionsWithoutInvoices={transactionsWithoutInvoices}
        />
      </Box>

      <ReconciliationContent
        setTotalTransactions={setTotalTransactions}
        setTransactionsWithInvoices={setTransactionsWithInvoices}
        setTransactionsWithoutInvoices={setTransactionsWithoutInvoices}
      />
    </Stack>
  )
}

export default ReconciliationTab
