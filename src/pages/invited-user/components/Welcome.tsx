import { Box, Typography, Button } from '@mui/material'
import styles from './Welcome.module.scss'

// Define props type
type WelcomeProps = {
  setStep: React.Dispatch<React.SetStateAction<number | null>>
  practiceName?: string
  inviteeRole?: string
}

const Welcome: React.FC<WelcomeProps> = ({
  setStep,
  practiceName,
  inviteeRole
}) => {
  return (
    <Box className={styles.invitedUserOnboardingContainer}>
      <img src='/assets/Home.svg' alt='home icon' />
      <Box className={styles.invitedUserOnboardingInfo}>
        <Typography variant='h4'>Welcome to Monai Tech!</Typography>
        <Typography variant='h5'>
          You’ve been invited to join{' '}
          <span className='font-weight--700'>{practiceName}.</span>
        </Typography>
        <Typography variant='subtitle1'>
          You’ve been added as a{' '}
          <span className='font-weight--700'> {inviteeRole}. </span>
        </Typography>
      </Box>
      <Box className='center-align-width--100'>
        <Button
          size='large'
          variant='contained'
          className={styles.setPasswordBtn}
          onClick={() => setStep(2)}
        >
          Continue
        </Button>
      </Box>
    </Box>
  )
}

export default Welcome
