import { Box, Typography, Button } from '@mui/material'
import styles from './Welcome.module.scss'

// Define props type
type WelcomeProps = {
  setStep: React.Dispatch<React.SetStateAction<number>>
}

const Welcome: React.FC<WelcomeProps> = ({ setStep }) => {
  return (
    <Box className={styles.invitedUserOnboardingContainer}>
      <img src='/assets/Home.svg' alt='home icon' />
      <Box className={styles.invitedUserOnboardingInfo}>
        <Typography variant='h4'>
          Welcome to monai, <span className='font-weight--700'> Sarah!</span>
        </Typography>
        <Typography variant='h5'>
          You’ve been invited to join{' '}
          <span className='font-weight--700'>Greenfield Dental Practice.</span>
        </Typography>
        <Typography variant='subtitle1'>
          You’ve been added as a{' '}
          <span className='font-weight--700'> Practice Manager. </span>
        </Typography>
      </Box>
      <Box className='center-align-width--100'>
        <Button
          size='large'
          variant='contained'
          className={styles.setPasswordBtn}
          onClick={() => setStep(2)}
        >
          Set password
        </Button>
      </Box>
    </Box>
  )
}

export default Welcome
