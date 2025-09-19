import { Box, Typography, Button } from '@mui/material'
import styles from './Congratulations.module.scss'

type WelcomeProps = {
  onContinue: () => void
}

const Welcome: React.FC<WelcomeProps> = ({ onContinue }) => {
  return (
    <Box className={styles.congratulationsContainer}>
      <Box className='center-align-width--100'>
        <img src='/assets/congrats.svg' alt='congrat icon' />
      </Box>
      <Box className={styles.congratsInfoContainer}>
        <Typography variant='h4'>
          Welcome to monai,{' '}
          <span className='font-weight--700'>Sarah!</span>{' '}
        </Typography>
        <Typography
          sx={{
            textAlign: 'center',
            px: 1
          }}
          variant='subtitle1'
          color='var(--color-text-primary)'
        >
          To get you started, we need to gather some information about your
          <span className='font-weight--700'> practice</span>. This will help us
          provide personalized insights and recommendations.{' '}
        </Typography>
      </Box>
      <Box className='center-align-width--100'>
        <Button
          size='large'
          variant='contained'
          className={styles.continueBtn}
          onClick={onContinue}
        >
          Get started
        </Button>
      </Box>
    </Box>
  )
}

export default Welcome
