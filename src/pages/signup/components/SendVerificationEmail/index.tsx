// src/pages/SignUp/components/SendVerificationEmail.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Box, Typography } from '@mui/material'
import LoadingButton from '@mui/lab/LoadingButton'
import dayjs, { Dayjs } from 'dayjs'
import styles from './EmailVerification.module.scss'
import RegistrationWrapper from 'src/components/registration-wrapper/RegistrationWrapper'
import RegistrationHeader from 'src/components/registration-wrapper/RegistrationHeader'
import { notify } from 'src/components/notistack/NotificationProvider' // optional
import { sendVerificationEmail } from 'src/services/auth/emailVerification'

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

  // expiry stored as dayjs object (or null)
  const expiryRef = useRef<Dayjs | null>(null)
  const intervalRef = useRef<number | null>(null)
  const mountedRef = useRef(true)

  // compute remaining seconds using dayjs
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
      // clear any existing interval
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
          justifyContent: 'flex-start',
          width: '100%',
          height: '100%',
          px: 2
        }}
      >
        <RegistrationHeader
          heading='Welcome to Monai Tech!'
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
              Didn&apos;t receive an email?
            </Typography>

            <LoadingButton
              className={styles.resendButton}
              size='large'
              variant='contained'
              onClick={handleResend}
              loading={loading}
              disabled={disabled}
            >
              {remaining > 0
                ? `Resend verification email (${formatSecondsAsMMSS(remaining)})`
                : 'Resend verification email'}
            </LoadingButton>
          </Box>

          <Box>
            <Typography variant='subtitle1' color='var(--color-text-secondary)'>
              If you still haven’t received the email, please{' '}
              <span className='info-main font-weight--700'>
                Contact support.
              </span>
            </Typography>
          </Box>
        </Box>
      </Box>
    </RegistrationWrapper>
  )
}

export default SendVerificationEmail
