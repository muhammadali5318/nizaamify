import { Box, Stack } from '@mui/material'
import styles from './transactions.module.scss'
import ModuleHeader from 'src/components/module-header'
import RevenueTable from './RevenueTable'

const Revenue = () => {
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
          heading='Categorise Revenue Transactions'
          subheading='Assign categories to your revenue transactions. You can skip and categorise later if needed.'
        />
      </Box>

      <RevenueTable />
    </Stack>
  )
}

export default Revenue
