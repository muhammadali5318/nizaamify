import { Box, Stack, Typography, LinearProgress } from '@mui/material'
import styles from './transactions.module.scss'
import ModuleHeader from 'src/components/module-header'
import TransactionsTable from './TransactionsTable'

const total = 8
const current = 1
const progressValue = (current / total) * 100

const Transactions = () => {
  return (
    <Stack
      spacing={2}
      className={styles.root}
      p={2}
      sx={{
        borderRadius: '24px',
        border: '1px solid #F1F1F1'
      }}
    >
      <Box
        width='100%'
        display='flex'
        flexDirection={{ xs: 'column', sm: 'row' }}
        justifyContent='space-between'
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        gap={2}
      >
        <ModuleHeader
          avatarSrc='/assets/bank-module.svg'
          heading='Categorise Transactions'
          subheading='Assign categories to your transactions. You can skip and categorize later if needed.'
        />

        <Box
          display='flex'
          alignItems='center'
          gap={1}
          width={{ xs: '100%', sm: 'auto' }}
          flexDirection={{ xs: 'column', sm: 'row' }}
        >
          <Typography variant='body2' fontWeight={500}>
            {current} of {total} categorised
          </Typography>

          <LinearProgress
            variant='determinate'
            value={progressValue}
            sx={{
              width: { xs: '100%', sm: 180 },
              height: 8,
              borderRadius: 5,
              backgroundColor: '#F1F1F1',
              '& .MuiLinearProgress-bar': {
                borderRadius: 5,
                backgroundColor: 'info.main'
              }
            }}
          />
        </Box>
      </Box>

      <TransactionsTable />
    </Stack>
  )
}

export default Transactions
