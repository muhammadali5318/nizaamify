import { Box, Stack, Typography } from '@mui/material'
import styles from './selectBank.module.scss'

const AccountCard = () => {
  return (
    <Box className={styles.accountCard}>
      <img src='/assets/wallet.svg' alt='wallet icon' />
      <Stack>
        <Typography variant='subtitle1' fontWeight={700}>
          Current Account
        </Typography>
        <Typography variant='caption' color='text.secondary'>
          Account ending 1234
        </Typography>
      </Stack>
    </Box>
  )
}

export default AccountCard
