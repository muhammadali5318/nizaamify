import { Box, Typography, Button } from '@mui/material'
import styles from './Congratulations.module.scss'
import { useNavigate } from 'react-router'

type CongratulationsProps = {
  title?: string
  message: string
}

const Congratulations: React.FC<CongratulationsProps> = ({
  message,
  title = 'Congratulations!'
}) => {
  const navigate = useNavigate()

  const handleContinue = () => {
    navigate('/auth/login')
  }

  return (
    <Box
      className={styles.congratulationsContainer}
      sx={{
        width: { xs: '100%', md: '636px' },
        mx: 'auto',
        px: { xs: 3, md: '48px' },
        py: { xs: 3, md: '36px' }
      }}
    >
      <Box className='center-align-width--100'>
        <Box
          component='img'
          src='/assets/congrats.svg'
          alt='congrat icon'
          sx={{
            width: { xs: '120px', sm: '150px', md: 'auto' },
            maxWidth: '100%',
            height: 'auto',
            display: 'block'
          }}
        />
      </Box>

      <Box className={styles.congratsInfoContainer}>
        <Typography variant='h4' className='font-weight--700' align='center'>
          {title}
        </Typography>

        <Typography
          variant='subtitle1'
          color='var(--color-text-secondary)'
          sx={{
            width: { xs: '100%', md: '364px' },
            maxWidth: '100%',
            textAlign: 'center',
            wordBreak: 'break-word'
          }}
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
          sx={{
            width: { xs: '100%', md: '210px' }
          }}
        >
          Continue
        </Button>
      </Box>
    </Box>
  )
}

export default Congratulations
