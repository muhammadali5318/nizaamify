import { Alert, Box, Stack, Typography } from '@mui/material'
import StatsCard from 'src/components/team-management/StatsCard'
import StatsChart from './components/stats-chart'
import ReconciliationContent from './components/recon-content'
const VERIFICATION_LIMIT = 4

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
  const remaining = Math.max(VERIFICATION_LIMIT - transactionsWithInvoices, 0)

  const percentage =
    totalTransactions > 0
      ? Math.round((transactionsWithInvoices / totalTransactions) * 100)
      : 0

  const message = `Upload invoices for your transactions to achieve verified status.
          You've uploaded ${transactionsWithInvoices} of
          ${transactionsWithoutInvoices} invoices (${percentage}%). Upload 
          ${remaining} more to get verified.`

  return (
    <Stack spacing={2.5}>
      {transactionsWithInvoices < VERIFICATION_LIMIT && (
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

          <Typography color='info.dark'>{message}</Typography>
        </Alert>
      )}

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
          total={totalTransactions}
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
