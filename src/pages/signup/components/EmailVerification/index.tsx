// File: src/pages/EmailVerification/EmailVerification.tsx
import React, { useEffect, useRef, useState } from 'react'
import { Box, CircularProgress, Typography } from '@mui/material'
import RegistrationWrapper from 'src/components/registration-wrapper/RegistrationWrapper'
import RegistrationHeader from 'src/components/registration-wrapper/RegistrationHeader'
import Congratulations from 'src/components/congratulations'
import { apiClientOpen } from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import { Link, useLocation, useNavigate } from 'react-router'
import EmailVerificationStatus from './EmailVerificationStatus'
import { sendVerificationEmail } from 'src/services/auth/emailVerification'
import HavingTrouble from 'src/components/contact-support/HavingTrouble'
import ContactSupport from 'src/components/contact-support'
import { CONFIG } from 'src/config-global'
import { paths } from 'src/paths'
import { useAuth } from 'src/context/AuthProvider'

type VerificationStatus =
  | 'expired'
  | 'verified'
  | 'invalid'
  | 'congrats'
  | 'emailNotVerified'
  | 'requestThrottled'
  | 'accountDeactivated'
  | 'unauthorized'
  | 'subscribed'
  | 'subscriptionFailed'

const EmailVerification: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const accessToken = useAuth()

  const [status, setStatus] = useState<VerificationStatus | 'loading'>(
    'loading'
  )
  const [email, setEmail] = useState<string | null>(null)
  const [practiceId, setPracticeId] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [auth0Id, setAuth0Id] = useState<string | null>(null)
  const [throttleMinutes, setThrottleMinutes] = useState<number | null>(null)

  const [cooldown, setCooldown] = useState<number>(0)
  const [sending, setSending] = useState<boolean>(false)
  const intervalRef = useRef<number | null>(null)
  // auth/subscribed?session_id=cs_test_a1jeHBsQ7FZW2MxNXQqP2GTxOzJbvolP5D9xXONG30UJX8O2GjHtcZBiLz
  useEffect(() => {
    // keep + signs intact
    const fixedSearch = location.search.replace(/\+/g, '%2B')
    const searchParams = new URLSearchParams(fixedSearch)

    const rawEmail = searchParams.get('email')
    const rawPracticeId = searchParams.get('practice_id')
    const rawToken = searchParams.get('token')
    const rawAuth0Id = searchParams.get('auth0Id')
    const accountDeactivated = !!searchParams.get('accountDeactivated')
    const unauthorized = !!searchParams.get('unauthorized')
    const emailVerified = !!searchParams.get('emailVerified')
    const sessionId = !!searchParams.get('session_id')

    setEmail(rawEmail)
    setToken(rawToken)
    setAuth0Id(rawAuth0Id)
    setPracticeId(rawPracticeId)

    if (rawAuth0Id) {
      setStatus('emailNotVerified')
    } else if (accountDeactivated) {
      setStatus('accountDeactivated')
    } else if (unauthorized) {
      setStatus('unauthorized')
    } else if (emailVerified) {
      setStatus('congrats')
    } else if (sessionId) {
      setStatus('subscribed')
    } else if (location.pathname === '/auth/subscription-failed') {
      if (accessToken) {
        navigate(paths.billing)
      } else {
        setStatus('subscriptionFailed')
      }
    }
  }, [location.search])

  useEffect(() => {
    if (auth0Id) {
      return
    }

    if (!email || !token) {
      return
    }

    let cancelled = false
    const verify = async () => {
      setStatus('loading')
      try {
        const response = await apiClientOpen.put(endpoints.signup.verifyEmail, {
          email,
          practice_id: practiceId,
          token
        })

        if (
          response.status === 200 &&
          response.data.message === 'Email has been verified successfully!'
        ) {
          if (!cancelled) {
            if (CONFIG.envName === 'dev') {
              navigate(
                `/auth/signup?step=7&practiceId=${practiceId}&email=${email}`
              )
            } else {
              setStatus('congrats')
            }
          }
          return
        }

        if (!cancelled) setStatus('invalid')
      } catch (err: any) {
        if (err?.message === 'The email verification link has expired.') {
          if (!cancelled) setStatus('expired')
          return
        }

        if (
          err?.message === 'This email verification link has already been used.'
        ) {
          if (!cancelled) setStatus('verified')
          return
        }

        if (err?.message === 'The verification link is invalid.') {
          if (!cancelled) setStatus('invalid')
          return
        }

        if (
          typeof err?.detail === 'string' &&
          err.detail.includes('Request was throttled')
        ) {
          const match = err.detail.match(/available in (\d+) seconds/i)
          if (match) {
            const seconds = parseInt(match[1], 10)
            const minutes = Math.ceil(seconds / 60)
            setThrottleMinutes(minutes)
          }
          if (!cancelled) setStatus('requestThrottled')
          return
        }

        // default fallback
        if (!cancelled) setStatus('invalid')
      }
    }

    verify()

    return () => {
      cancelled = true
    }
  }, [email, token, auth0Id]) // included auth0Id to ensure skipping when it exists

  useEffect(() => {
    if (cooldown <= 0) return

    intervalRef.current = window.setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) {
            window.clearInterval(intervalRef.current)
            intervalRef.current = null
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [cooldown])

  const handleResendClick = async () => {
    if (cooldown > 0 || sending) return

    try {
      setSending(true)

      const payload =
        auth0Id != null
          ? { auth0Id: `auth0|${auth0Id}` }
          : { email: email ?? undefined }

      await sendVerificationEmail(payload)
      setCooldown(60)
    } catch (err) {
      console.error('Failed to resend verification email', err)
    } finally {
      setSending(false)
    }
  }

  return (
    <RegistrationWrapper>
      <RegistrationHeader />

      <Box>
        {status === 'loading' ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : status === 'expired' ? (
          <EmailVerificationStatus
            iconSrc='/assets/warning.svg'
            iconAlt='Warning — link expired'
            buttonText={
              cooldown > 0
                ? `Send new verification email (${cooldown}s)`
                : 'Send new verification email'
            }
            disabled={cooldown > 0 || sending}
            onButtonClick={handleResendClick}
            footer={
              <>
                <Typography variant='subtitle1' color='textSecondary'>
                  If you still haven’t received the email, please{' '}
                  <ContactSupport />
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
                  {email ?? 'your email'}
                </span>
                .
              </Typography>
            </>
          </EmailVerificationStatus>
        ) : status === 'emailNotVerified' ? (
          // Copied same component/structure as 'expired' case (per request).
          <EmailVerificationStatus
            iconSrc='/assets/warning.svg'
            iconAlt='Email not verifiedd'
            buttonText={
              cooldown > 0
                ? `Send new verification email (${cooldown}s)`
                : 'Send new verification email'
            }
            disabled={cooldown > 0 || sending}
            onButtonClick={handleResendClick}
            footer={
              <>
                <Typography variant='subtitle1' color='textSecondary'>
                  If you still haven’t received the email, please{' '}
                  <ContactSupport />
                </Typography>
              </>
            }
          >
            <>
              <Typography variant='h4' className='font-weight--700'>
                Email not verified
              </Typography>
              <Typography variant='subtitle1' color='textSecondary'>
                Your email has not been verified yet. If you have an account
                with us, check your inbox for the verification link. You can
                request a new verification email below.
              </Typography>
              <Typography variant='subtitle1' color='textSecondary'>
                We can send you a new link to your registered Email.
              </Typography>
            </>
          </EmailVerificationStatus>
        ) : status === 'verified' ? (
          <EmailVerificationStatus
            iconSrc='/assets/verified.svg'
            iconAlt='Verified'
            buttonText='Go to sign in'
            onButtonClick={() => navigate('/auth/login')}
          >
            <>
              <Typography variant='h4' className='font-weight--700'>
                Email already verified
              </Typography>
              <Typography variant='subtitle1' color='textSecondary'>
                Your email{' '}
                <span className='font-weight--700 text-primary'>
                  {email ?? 'your email'}
                </span>{' '}
                has already been verified. You can now sign in to your account.
              </Typography>
            </>
          </EmailVerificationStatus>
        ) : status === 'invalid' ? (
          <EmailVerificationStatus
            iconSrc='/assets/danger.svg'
            iconAlt='Invalid link'
            buttonText='Go to sign in'
            footer={
              <>
                <Typography variant='subtitle1' color='textSecondary'>
                  Don’t have an account?{' '}
                  <Link
                    to={'/auth/signup'}
                    className='font-weight--700 info-main cursor-pointer text-decoration--none'
                  >
                    Sign up
                  </Link>
                </Typography>
                <HavingTrouble />
              </>
            }
            onButtonClick={() => navigate('/auth/login')}
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
        ) : status === 'requestThrottled' ? (
          <EmailVerificationStatus
            iconSrc='/assets/danger.svg'
            iconAlt='Request throttled'
            buttonText='Go to sign in'
            onButtonClick={() => navigate('/auth/login')}
            footer={
              <Typography variant='subtitle1' color='textSecondary'>
                Don’t have an account?{' '}
                <Link
                  to={'/auth/signup'}
                  className='font-weight--700 info-main cursor-pointer text-decoration--none'
                >
                  Sign up
                </Link>
              </Typography>
            }
          >
            <>
              <Typography variant='h4' className='font-weight--700'>
                Too many requests
              </Typography>
              <Typography variant='subtitle1' color='textSecondary'>
                {throttleMinutes
                  ? `Your request was throttled. Please try again in about ${throttleMinutes} minute${throttleMinutes > 1 ? 's' : ''}.`
                  : 'Your request was throttled. Please wait before trying again.'}
              </Typography>
            </>
          </EmailVerificationStatus>
        ) : status === 'accountDeactivated' ? (
          <EmailVerificationStatus
            iconSrc='/assets/danger.svg'
            iconAlt='Request throttled'
            buttonText='Close'
            onButtonClick={() => navigate('/auth/login')}
          >
            <>
              <Typography variant='h4' className='font-weight--700'>
                Account Deactivated
              </Typography>
              <Typography variant='subtitle1' color='textSecondary'>
                Your account has been deactivated by your practice
                administrator. Please contact support if you need any
                assistance. <ContactSupport />
              </Typography>
            </>
          </EmailVerificationStatus>
        ) : status === 'unauthorized' ? (
          <EmailVerificationStatus
            iconSrc='/assets/danger.svg'
            iconAlt='Request throttled'
            buttonText='Close'
            onButtonClick={() => navigate('/auth/login')}
          >
            <>
              <Typography variant='h4' className='font-weight--700'>
                Unauthorized Access
              </Typography>
              <Typography variant='subtitle1' color='textSecondary'>
                It appears that you do not have permission to access the Monai
                platform. <ContactSupport />
              </Typography>
            </>
          </EmailVerificationStatus>
        ) : status === 'subscriptionFailed' ? (
          <EmailVerificationStatus
            iconSrc='/assets/danger.svg'
            iconAlt='Request throttled'
            buttonText='Go to sign in'
            onButtonClick={() => navigate('/auth/login')}
          >
            <>
              <Typography variant='h4' className='font-weight--700'>
                Oops! Subscription Failed
              </Typography>
              <Typography variant='subtitle1' color='textSecondary'>
                Something went wrong, but you can still log in.
              </Typography>
              <Typography variant='subtitle1' color='textSecondary'>
                Once logged in, you can easily choose a plan from the app.
              </Typography>
            </>
          </EmailVerificationStatus>
        ) : status === 'congrats' ? (
          <Congratulations
            title='Account created successfully'
            message='Your Monai account has been created!'
          />
        ) : status === 'subscribed' ? (
          <Congratulations
            title='Congratulation!'
            message='Your subscription plan has been subscribed!'
            onContinue={() =>
              navigate(accessToken ? paths.billing : '/auth/login')
            }
          />
        ) : null}
      </Box>
    </RegistrationWrapper>
  )
}

export default EmailVerification
