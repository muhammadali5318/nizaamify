import { Alert, Box, Stack, Typography } from '@mui/material'
import StatsCard from 'src/components/team-management/StatsCard'
import StatsChart from './components/stats-chart'
import ReconciliationContent from './components/recon-content'

const ReconciliationTab = () => {
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
        <Typography color='info.dark' component='div' sx={{ margin: 0 }}>
          Upload invoices for your transactions to achieve verified status.
          You&apos;ve uploaded 2 of 7 invoices (40%). Upload 4 more to get
          verified.
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
          value={0}
        />
        <StatsCard
          iconSrc='active-member.svg'
          label='With Invoices'
          value={0}
        />
        <StatsCard
          iconSrc='pending-member.svg'
          label='Missing Invoices'
          value={5}
        />
        <StatsChart value={82} />
      </Box>
      <ReconciliationContent />
    </Stack>
  )
}

export default ReconciliationTab
