import { Box, Typography } from '@mui/material'
import styles from './selectBank.module.scss'

type BankCardProp = {
  title: string
  handleClick?: () => void
}
const BankCard: React.FC<BankCardProp> = ({ title, handleClick }) => {
  return (
    <Box className={styles.bankCard} onClick={handleClick}>
      <Box
        display={'flex'}
        flexDirection={'column'}
        gap={2}
        alignItems={'center'}
        justifyContent={'center'}
      >
        <img
          className='icon-dimension--36'
          src='/assets/dental-icon.svg'
          alt='dental bank icon'
        />
        <Typography variant='subtitle1' fontWeight={700}>
          {title}
        </Typography>
      </Box>
    </Box>
  )
}

export default BankCard
