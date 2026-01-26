import { Box, Typography, Button } from '@mui/material'
import styles from './Congratulations.module.scss'
import { useInitialData } from 'src/hooks/useFetchInitialData'
import { useAuth0 } from '@auth0/auth0-react'
import { useAuth } from 'src/context/AuthProvider'

type WelcomeProps = {
  onContinue: () => void
}

const Welcome: React.FC<WelcomeProps> = ({ onContinue }) => {
  const { user } = useAuth0()
  const { accessToken } = useAuth()
  const { data: practiceData } = useInitialData(!!accessToken)
  return (
    <Box className={styles.congratulationsContainer}>
      <Box className='center-align-width--100'>
        <img src='/assets/congrats.svg' alt='congrat icon' />
      </Box>
      <Box className={styles.congratsInfoContainer}>
        <Typography variant='h4' textAlign={'center'}>
          Welcome to Monai Tech,{' '}
          <span className='font-weight--700'>{user?.name}!</span>{' '}
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
          <span className='font-weight--700'>
            {' '}
            {practiceData?.practice_name}
          </span>
          . This will help us provide personalized insights and
          recommendations.{' '}
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
