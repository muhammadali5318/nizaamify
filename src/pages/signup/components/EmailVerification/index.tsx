import { Box, Button, Typography } from '@mui/material'
import styles from './EmailVerification.module.scss'
import RegistrationWrapper from 'src/components/registration-wrapper/RegistrationWrapper'
import RegistrationHeader from 'src/components/registration-wrapper/RegistrationHeader'

type EmailVerificationProps = {
  email: string
}

const EmailVerification: React.FC<EmailVerificationProps> = ({ email }) => {
  return (
    <RegistrationWrapper>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          width: '100%',
          height: '100%',
          px: 2
        }}
      >
        <RegistrationHeader
          heading='Welcome to monai!'
          subHeading='Let’s get you onboarded!'
        />
        <Box className={styles.emailVerificationRoot}>
          <Box className={styles.emailVerificationInfoContainer}>
            <Typography variant='h4' className='font-weight--700'>
              Verify your email address
            </Typography>
            <Typography variant='subtitle1' color='var(--color-text-secondary)'>
              Please verify your email address before signing in. We have sent a
              verification link to :
            </Typography>
          </Box>
          <Box className={styles.emailVerificationInfoContainer}>
            <Typography
              className='font-style--italic font-weight--700'
              variant='h6'
            >
              {email}
            </Typography>
            <Typography variant='subtitle1' color='var(--color-text-secondary)'>
              The verification link expires in 60 minutes.
            </Typography>
          </Box>
          <Box className={styles.emailVerificationActionContainer}>
            <Typography variant='subtitle1' color='var(--color-text-secondary)'>
              Don’t receive an email?
            </Typography>
            <Button
              className={styles.resendButton}
              size='large'
              variant='contained'
            >
              Resend Verification Email
            </Button>
          </Box>
          <Box>
            <Typography variant='subtitle1' color='var(--color-text-secondary)'>
              If you still haven’t received the email, please{' '}
              <span className='info-main font-weight--700'>
                Contact Support.{' '}
              </span>
            </Typography>
          </Box>
        </Box>
      </Box>
    </RegistrationWrapper>
  )
}

export default EmailVerification
