import { Box, Stack, Typography } from '@mui/material'
import styles from './selectBank.module.scss'

type BankCardProp = {
  title: string
  handleClick?: () => void
}
const BankCard: React.FC<BankCardProp> = ({ title, handleClick }) => {
  return (
    <Box className={styles.bankCard} onClick={handleClick}>
      <Stack spacing={2} alignItems={'center'}>
        <img
          style={{
            width: '36px',
            height: '36px'
          }}
          src='/assets/dental-icon.svg'
          alt='dental bank icon'
        />
        <Typography variant='subtitle1' fontWeight={700}>
          {title}
        </Typography>
      </Stack>
    </Box>
  )
}

export default BankCard
