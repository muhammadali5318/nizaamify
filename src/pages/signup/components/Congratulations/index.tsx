import { Box, Button, Typography } from '@mui/material'
import RegistrationWrapper from 'src/components/registration-wrapper/RegistrationWrapper'
import styles from './Congratulations.module.scss'
import RegistrationHeader from 'src/components/registration-wrapper/RegistrationHeader'
import EmailVerificationStatus from './EmailVerificationStatus'

const handleResend = async () => {
  // eslint-disable-next-line no-console
  console.log('handled')
}

// type for better safety
type VerificationStatus = 'expired' | 'verified' | 'invalid' | 'congrats'

const renderStatus = (status: VerificationStatus) => {
  switch (status) {
    case 'expired':
      return (
        <EmailVerificationStatus
          iconSrc='/assets/warning.svg'
          iconAlt='Warning — link expired'
          buttonText='Send new verification email'
          onButtonClick={handleResend}
          footer={
            <>
              <Typography variant='subtitle1' color='textSecondary'>
                You can re-enter your email{' '}
                <span className='font-weight--700 info-main text-underline cursor-pointer'>
                  here
                </span>{' '}
                if the one you entered was incorrect.
              </Typography>
              <Typography variant='subtitle1' color='textSecondary'>
                If you still haven’t received the email, please{' '}
                <span className='font-weight--700 info-main cursor-pointer'>
                  Contact Support.
                </span>
              </Typography>
            </>
          }
        >
          <>
            <Typography variant='h4' className='font-weight--700'>
              Link expired
            </Typography>
            <Typography variant='subtitle1' color='textSecondary'>
              This link has expired. Verification links are valid for 60
              minutes, but you can request a new one below.
            </Typography>
            <Typography variant='subtitle1' color='textSecondary'>
              We can send you a new link to{' '}
              <span className='font-weight--700 text-primary'>
                Sarah.Daniel@example.com
              </span>
              .
            </Typography>
          </>
        </EmailVerificationStatus>
      )

    case 'verified':
      return (
        <EmailVerificationStatus
          iconSrc='/assets/verified.svg'
          iconAlt='Verified'
          buttonText='Go to Sign In'
          onButtonClick={handleResend}
          footer={
            <Typography variant='subtitle1' color='textSecondary'>
              Having trouble? Please{' '}
              <span className='font-weight--700 info-main cursor-pointer'>
                Contact Support.
              </span>
            </Typography>
          }
        >
          <>
            <Typography variant='h4' className='font-weight--700'>
              Email already verified
            </Typography>
            <Typography variant='subtitle1' color='textSecondary'>
              Your email{' '}
              <span className='font-weight--700 text-primary'>
                Sarah.Daniel@example.com
              </span>{' '}
              has already been verified. You can now sign in to your account.
            </Typography>
          </>
        </EmailVerificationStatus>
      )

    case 'invalid':
      return (
        <EmailVerificationStatus
          iconSrc='/assets/danger.svg'
          iconAlt='Invalid link'
          buttonText='Go to Sign In'
          onButtonClick={handleResend}
          footer={
            <>
              <Typography variant='subtitle1' color='textSecondary'>
                Don’t have an account?{' '}
                <span className='font-weight--700 info-main cursor-pointer'>
                  Sign up
                </span>
              </Typography>
              <Typography variant='subtitle1' color='textSecondary'>
                Having trouble? Please{' '}
                <span className='font-weight--700 info-main cursor-pointer'>
                  Contact Support.
                </span>
              </Typography>
            </>
          }
        >
          <>
            <Typography variant='h4' className='font-weight--700'>
              Invalid verification link
            </Typography>
            <Typography variant='subtitle1' color='textSecondary'>
              Verification link is not valid. It may be broken or has already
              been used.
            </Typography>
          </>
        </EmailVerificationStatus>
      )

    case 'congrats':
      return (
        <Box className={styles.congratulationsContainer}>
          <Box className='center-align-width--100'>
            <img src='/assets/congrats.svg' alt='congratc icon' />
          </Box>
          <Box className={styles.congratsInfoContainer}>
            <Typography variant='h4' className='font-weight--700'>
              Congratulation!{' '}
            </Typography>
            <Typography
              sx={{
                width: '364px',
                textAlign: 'center'
              }}
              variant='subtitle1'
              color='var(--color-text-secondary)'
            >
              Your email has been verified and your Account has been created
              successfully.
            </Typography>
          </Box>
          <Box className='center-align-width--100'>
            <Button
              size='large'
              variant='contained'
              className={styles.continueBtn}
            >
              Continue
            </Button>
          </Box>
        </Box>
      )

    default:
      return null
  }
}

const Congratulations = () => {
  const status: VerificationStatus = 'congrats'

  return (
    <RegistrationWrapper>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          height: '100%',
          px: 2
        }}
      >
        <RegistrationHeader />
        <Box className={styles.congratulationsRoot}>{renderStatus(status)}</Box>
      </Box>
    </RegistrationWrapper>
  )
}

export default Congratulations
