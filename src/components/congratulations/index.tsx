import { Box, Typography, Button } from '@mui/material'
import styles from './Congratulations.module.scss'
import { useNavigate } from 'react-router'

type CongratulationsProps = {
  message: string
}

const Congratulations: React.FC<CongratulationsProps> = ({ message }) => {
  const navigate = useNavigate()

  const handleContinue = () => {
    navigate('/auth/login')
  }

  return (
    <Box className={styles.congratulationsContainer}>
      <Box className='center-align-width--100'>
        <img src='/assets/congrats.svg' alt='congrat icon' />
      </Box>
      <Box className={styles.congratsInfoContainer}>
        <Typography variant='h4' className='font-weight--700'>
          Congratulations!{' '}
        </Typography>
        <Typography
          sx={{
            width: '364px',
            textAlign: 'center'
          }}
          variant='subtitle1'
          color='var(--color-text-secondary)'
        >
          {message}
        </Typography>
      </Box>
      <Box className='center-align-width--100'>
        <Button
          size='large'
          variant='contained'
          className={styles.continueBtn}
          onClick={handleContinue}
        >
          Continue
        </Button>
      </Box>
    </Box>
  )
}

export default Congratulations
