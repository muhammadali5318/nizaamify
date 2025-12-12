import { Box, Button, Stack, TextField, Typography } from '@mui/material'
import styles from './selectBank.module.scss'
import { ChevronLeft } from '@mui/icons-material'
import BankCard from './BankCard'

const SelectYourBank = () => {
  return (
    <Box className={styles.selectYourBankRoot}>
      <Box className={styles.selectYourBankContainer}>
        <Button startIcon={<ChevronLeft />} variant='text' size='small'>
          Back
        </Button>
        <Stack spacing={1}>
          <Typography variant='h5' component='h1' fontWeight={700}>
            Select Your Bank{' '}
          </Typography>
          <Typography variant='body1' color='text.secondary'>
            Choose the bank you want to connect
          </Typography>
        </Stack>
        <TextField
          fullWidth
          label='Search'
          placeholder='Search for you bank...'
        />
        <Box className={styles.bankCardContainer}>
          <BankCard title='Monzo' />
          <BankCard title='Monzo' />
          <BankCard title='Monzo' />
        </Box>
        <Box className={styles.bankCardContainer}>
          <BankCard title='Monzo' />
          <BankCard title='Monzo' />
          <BankCard title='Monzo' />
        </Box>
      </Box>
    </Box>
  )
}

export default SelectYourBank
