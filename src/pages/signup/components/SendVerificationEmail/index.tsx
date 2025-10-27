import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Box, Button, Typography } from '@mui/material'
import dayjs, { Dayjs } from 'dayjs'
import styles from './EmailVerification.module.scss'
import RegistrationWrapper from 'src/components/registration-wrapper/RegistrationWrapper'
import RegistrationHeader from 'src/components/registration-wrapper/RegistrationHeader'
import { notify } from 'src/components/notistack/NotificationProvider'
import { sendVerificationEmail } from 'src/services/auth/emailVerification'
import Footer from 'src/components/registration-wrapper/Footer'

type Props = {
  email: string
}

const COOLDOWN_SECONDS = 60

function formatSecondsAsMMSS(seconds: number) {
  const mm = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')
  const ss = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0')
  return `${mm}:${ss}`
}

const SendVerificationEmail: React.FC<Props> = ({ email }) => {
  const [remaining, setRemaining] = useState<number>(COOLDOWN_SECONDS)
  const [loading, setLoading] = useState<boolean>(false)

  const expiryRef = useRef<Dayjs | null>(null)
  const intervalRef = useRef<number | null>(null)
  const mountedRef = useRef(true)

  const computeRemainingSeconds = useCallback(() => {
    if (!expiryRef.current) return 0
    const diff = expiryRef.current.diff(dayjs(), 'second')
    return Math.max(0, diff)
  }, [])

  const tick = useCallback(() => {
    const secs = computeRemainingSeconds()
    if (secs <= 0) {
      setRemaining(0)
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    } else {
      setRemaining(secs)
    }
  }, [computeRemainingSeconds])

  const startTimer = useCallback(
    (seconds = COOLDOWN_SECONDS) => {
      expiryRef.current = dayjs().add(seconds, 'second')
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      tick()
      intervalRef.current = window.setInterval(tick, 500)
    },
    [tick]
  )

  useEffect(() => {
    mountedRef.current = true
    startTimer(COOLDOWN_SECONDS)

    return () => {
      mountedRef.current = false
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [startTimer])

  const handleResend = useCallback(async () => {
    if (loading) return
    if (remaining > 0) return

    setLoading(true)
    try {
      await sendVerificationEmail({ email: email })
      startTimer(COOLDOWN_SECONDS)
      notify?.success?.('A new verification email has been sent to your inbox.')
    } catch (err) {
      console.error('Failed to resend verification email', err)
      notify?.error?.('Failed to send verification email. Please try again.')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [email, loading, remaining, startTimer])

  const disabled = loading || remaining > 0

  return (
    <RegistrationWrapper>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '100vh'
        }}
      >
        <Box>
          <RegistrationHeader
            heading='Welcome to Monai Tech!'
            subHeading='Let’s get you onboarded!'
          />

          <Box
            className={styles.emailVerificationRoot}
            sx={{
              width: { xs: '100%', sm: '100%', md: '636px' },
              mx: 'auto',
              px: { xs: 2, sm: 3, md: 6 },
              py: { xs: 3, md: 4 }
            }}
          >
            <Box className={styles.emailVerificationInfoContainer}>
              <Typography variant='h4' className='font-weight--700'>
                Verify your email address
              </Typography>
              <Typography
                variant='subtitle1'
                color='var(--color-text-secondary)'
              >
                Please verify your email address before signing in. We have sent
                a verification link to:
              </Typography>
            </Box>

            <Box className={styles.emailVerificationInfoContainer}>
              <Typography
                variant='h6'
                className={`${styles.emailText} font-weight--700 font-style--italic`}
                sx={{ wordBreak: 'break-word' }}
              >
                {email}
              </Typography>
              <Typography
                variant='subtitle1'
                color='var(--color-text-secondary)'
              >
                The verification link expires in 60 minutes.
              </Typography>
            </Box>

            <Box className={styles.emailVerificationActionContainer}>
              <Box
                sx={{
                  width: '100%',
                  textAlign: 'center'
                }}
              >
                <Typography
                  variant='subtitle1'
                  color='var(--color-text-secondary)'
                >
                  Didn&apos;t receive an email?
                </Typography>
                <Typography
                  variant='subtitle1'
                  color='var(--color-text-secondary)'
                >
                  Please also check your spam/junk folder if you haven’t
                  received the email.
                </Typography>
              </Box>

              <Button
                size='large'
                variant='contained'
                onClick={handleResend}
                loading={loading}
                fullWidth
                disabled={disabled}
              >
                {remaining > 0
                  ? `Resend verification email (${formatSecondsAsMMSS(remaining)})`
                  : 'Resend verification email'}
              </Button>
            </Box>

            <Box>
              <Typography
                variant='subtitle1'
                color='var(--color-text-secondary)'
              >
                If you still haven’t received the email, please{' '}
                <span className='info-main font-weight--700'>
                  Contact support.
                </span>
              </Typography>
            </Box>
          </Box>
        </Box>

        <Footer />
      </Box>
    </RegistrationWrapper>
  )
}

export default SendVerificationEmail
