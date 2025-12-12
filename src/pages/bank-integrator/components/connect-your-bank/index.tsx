import { Box, Button, Stack, Typography } from '@mui/material'
import styles from './connnectBank.module.scss'

const ContectYourBank = () => {
  return (
    <Box className={styles.contectYourBankRoot}>
      <Box className={styles.contentWrapper}>
        <Stack spacing={{ xs: 3, sm: 4 }} alignItems='center'>
          <img
            src='/assets/bank.svg'
            alt='bank icon'
            style={{
              width: 'min(272px, 80vw)',
              height: 'auto'
            }}
          />

          <Stack spacing={1} alignItems='center' textAlign='center'>
            <Typography variant='h5' component='h1' fontWeight={700}>
              Connect Your Bank
            </Typography>
            <Typography variant='body1' color='text.secondary'>
              Securely link your bank to allow Monai to read balances and
              transactions.
            </Typography>
          </Stack>

          <Button
            size='large'
            variant='contained'
            fullWidth
            sx={{ maxWidth: 320 }}
          >
            Link Bank Account
          </Button>

          <Box display='flex' gap={1.5} alignItems='center' mt={2}>
            <img src='/assets/yapily.svg' alt='Yapily' style={{ height: 24 }} />
            <Typography color='text.secondary' variant='caption'>
              Powered by Yapily Connect
            </Typography>
          </Box>
        </Stack>
      </Box>
    </Box>
  )
}

export default ContectYourBank
