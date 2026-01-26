import { Box, Typography, Button } from '@mui/material'
import styles from './Welcome.module.scss'
import { toTitleCase } from 'src/utils/stringUtils'

// Define props type
type WelcomeProps = {
  setStep: React.Dispatch<React.SetStateAction<number | null>>
  practiceName?: string
  inviteeRole?: string
  isAccessRequest?: boolean
}

const Welcome: React.FC<WelcomeProps> = ({
  setStep,
  practiceName,
  inviteeRole,
  isAccessRequest
}) => {
  return (
    <Box className={styles.invitedUserOnboardingContainer}>
      <img src='/assets/Home.svg' alt='home icon' />
      <Box className={styles.invitedUserOnboardingInfo}>
        <Typography variant='h4'>Welcome to Monai Tech!</Typography>
        {isAccessRequest ? (
          <Box>
            <Typography variant='h5'>
              Your request has been approved!
            </Typography>
            <Typography variant='subtitle1'>
              Set up your password to get started with your account.
            </Typography>
          </Box>
        ) : (
          <>
            <Typography variant='h5'>
              You’ve been invited to join{' '}
              <span className='font-weight--700'>{practiceName}.</span>
            </Typography>
            <Typography variant='subtitle1'>
              You’ve been added as a{' '}
              <span className='font-weight--700'>
                {' '}
                {toTitleCase(inviteeRole ?? '')}.{' '}
              </span>
            </Typography>
          </>
        )}
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
