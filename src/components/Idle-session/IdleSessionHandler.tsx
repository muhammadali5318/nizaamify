// src/components/IdleSessionHandler.tsx
import { useEffect, useState, useRef } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { Dialog, Button, Box, Stack, Typography } from '@mui/material'

const TOTAL_IDLE_TIME = 15 * 60 * 1000 // 15 minutes
const WARNING_TIME = 14 * 60 * 1000 // 14 minutes

export default function IdleSessionHandler() {
  const { logout, getAccessTokenSilently } = useAuth0()
  const [showWarning, setShowWarning] = useState(false)

  // keep latest showWarning value in a ref (prevents stale closure)
  const showWarningRef = useRef(showWarning)
  useEffect(() => {
    showWarningRef.current = showWarning
  }, [showWarning])

  useEffect(() => {
    let idleTimeout: ReturnType<typeof setTimeout>
    let warningTimeout: ReturnType<typeof setTimeout>

    const resetTimers = () => {
      // if warning is already shown, don’t auto-reset
      if (showWarningRef.current) return

      if (idleTimeout) clearTimeout(idleTimeout)
      if (warningTimeout) clearTimeout(warningTimeout)

      // Show warning at 14m
      warningTimeout = setTimeout(() => {
        setShowWarning(true)
      }, WARNING_TIME)

      // Force logout at 15m
      idleTimeout = setTimeout(() => {
        logout({
          logoutParams: { returnTo: window.location.origin }
        })
      }, TOTAL_IDLE_TIME)
    }

    const throttledReset = throttle(resetTimers, 500)

    const events = [
      'mousemove',
      'keydown',
      'click',
      'scroll',
      'touchstart',
      'touchmove',
      'focus'
    ]
    events.forEach((e) => window.addEventListener(e, throttledReset))

    resetTimers() // start timers on mount

    return () => {
      events.forEach((e) => window.removeEventListener(e, throttledReset))
      if (idleTimeout) clearTimeout(idleTimeout)
      if (warningTimeout) clearTimeout(warningTimeout)
    }
  }, [logout])

  const handleContinue = async () => {
    try {
      await getAccessTokenSilently()
      setShowWarning(false)
    } catch (err) {
      console.error('Token renewal failed:', err)
      logout({
        logoutParams: { returnTo: window.location.origin }
      })
    }
  }

  function throttle(func: (...args: any[]) => void, limit: number) {
    let inThrottle: boolean
    return function (this: any, ...args: any[]) {
      if (!inThrottle) {
        func.apply(this, args)
        inThrottle = true
        setTimeout(() => (inThrottle = false), limit)
      }
    }
  }

  return (
    <Dialog
      open={showWarning}
      slotProps={{
        paper: {
          sx: {
            width: '540px',
            maxWidth: '540px',
            borderRadius: '12px'
          }
        }
      }}
    >
      <Stack
        spacing={2}
        sx={{
          width: '100%',
          padding: '36px 48px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        <img
          className='icon-dimension--88'
          src='/assets/idle-warning.svg'
          alt='warning icon'
        />
        <Box />
        <Box>
          <Typography
            textAlign={'center'}
            variant='h4'
            className='font-weight--700'
          >
            Session expiring soon!
          </Typography>
          <Typography
            textAlign={'center'}
            variant='subtitle1'
            color='var(--color-text-secondary)'
          >
            Your session will expire in{' '}
            <span className='font-weight--700 font-color--warning-dark'>
              60 seconds
            </span>{' '}
            due to inactivity
          </Typography>
          <Typography
            textAlign={'center'}
            variant='subtitle1'
            color='var(--color-text-secondary)'
          >
            Click &apos;OK&apos; to stay logged in.
          </Typography>
        </Box>
        <Button
          sx={{ width: '295px', backgroundColor: 'var(--color-primary-black)' }}
          onClick={handleContinue}
          size='large'
          variant='contained'
        >
          OK
        </Button>
      </Stack>
    </Dialog>
  )
}
