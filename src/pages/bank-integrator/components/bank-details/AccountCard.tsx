import { Box, Stack, Typography } from '@mui/material'
import styles from './selectBank.module.scss'
import { BankAccount } from '.'

interface AccountCardProps {
  account: BankAccount
}

const AccountCard: React.FC<AccountCardProps> = ({ account }) => {
  const lastFourDigits = account?.iban ? account.iban.slice(-4) : '-'
  return (
    <Box className={styles.accountCard}>
      <img src='/assets/wallet.svg' alt='wallet icon' />
      <Stack>
        <Typography variant='subtitle1' fontWeight={700}>
          {account.name}
        </Typography>

        <Typography variant='caption' color='text.secondary'>
          Account ending {lastFourDigits}
        </Typography>
      </Stack>
    </Box>
  )
}

export default AccountCard
