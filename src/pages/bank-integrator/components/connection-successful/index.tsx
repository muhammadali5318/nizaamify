import { Box, Button, Stack, Typography, CircularProgress } from '@mui/material'
import styles from './connectionSuccessful.module.scss'
import { useNavigate } from 'react-router'
import { paths } from 'src/paths'
import { useEffect, useState } from 'react'
import { endpoints } from 'src/services/backendUrl'
import apiClient from 'src/services/api-client'
import { useActivePractice } from 'src/hooks/useActivePractice'
import { useDispatch, useSelector } from 'react-redux'
import {
  selectBankConnectionId,
  selectBankConnectionLoading,
  selectBankConnectionError,
  setConnectionId,
  setStatus,
  setLoading,
  setError
} from 'src/store/slices/bankConnectionSlice'

const ConnectionSuccessful = () => {
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const [bankName, setBankName] = useState()

  const connectionId = useSelector(selectBankConnectionId)
  const loading = useSelector(selectBankConnectionLoading)
  const error = useSelector(selectBankConnectionError)

  const { activePracticeId } = useActivePractice()

  // Sync connectionId from localStorage only on mount (if not already in Redux)
  useEffect(() => {
    if (!connectionId) {
      const storedId = localStorage.getItem('bank_connection_id')
      if (storedId) {
        dispatch(setConnectionId(storedId))
      }
    }
  }, [connectionId, dispatch])

  const pollConsentStatus = async (): Promise<string> => {
    const response = await apiClient.post(
      endpoints.bankIntegrator.finalzieConnection(activePracticeId ?? ''),
      {
        connection_id: connectionId
      }
    )
    return response.data.data
  }

  useEffect(() => {
    if (!connectionId) return

    const interval = setInterval(async () => {
      try {
        const data = await pollConsentStatus()
        dispatch(setStatus(data?.status))

        if (data?.status === 'AUTHORIZED') {
          setBankName(data?.institution?.full_name)
          dispatch(setLoading(false))
          clearInterval(interval)
        }
      } catch (err) {
        console.error('Polling error:', err)
        dispatch(setError(true))
        dispatch(setLoading(false))
        clearInterval(interval)
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [connectionId, dispatch, activePracticeId])

  if (loading) {
    return (
      <Box className={styles.contectYourBankRoot}>
        <Box className={styles.contentWrapper}>
          <Stack spacing={{ xs: 2, sm: 2 }} alignItems='center'>
            <CircularProgress size={40} />
            <Stack spacing={1} alignItems='center' textAlign='center'>
              <Typography variant='h5' component='h1' fontWeight={700}>
                Awaiting Authorization
              </Typography>
              <Typography variant='body1' color='text.secondary'>
                We are verifying your bank connection securely.
                <br />
                The connection status is being checked periodically. Please wait
                a moment.
              </Typography>
            </Stack>
          </Stack>
        </Box>
      </Box>
    )
  }

  if (error) {
    return (
      <Box className={styles.contectYourBankRoot}>
        <Box className={styles.contentWrapper}>
          <Stack spacing={{ xs: 2, sm: 2 }} alignItems='center'>
            <Typography variant='h5' color='error'>
              Something went wrong while checking the authorization status.
            </Typography>
            <Button
              variant='contained'
              onClick={() => navigate(paths.dashboard)}
            >
              Go to Dashboard
            </Button>
          </Stack>
        </Box>
      </Box>
    )
  }

  return (
    <Box className={styles.contectYourBankRoot}>
      <Box className={styles.contentWrapper}>
        <Stack spacing={{ xs: 2, sm: 2 }} alignItems='center'>
          <img
            src='/assets/success-check.svg'
            alt='success check'
            style={{
              width: 'min(126px, 80vw)',
              height: 'auto'
            }}
          />
          <Stack spacing={1} alignItems='center' textAlign='center'>
            <Typography variant='h5' component='h1' fontWeight={700}>
              Connection Established Successfully
            </Typography>
            <Typography variant='body1' color='text.secondary'>
              Your <strong>{bankName ?? 'bank'}</strong> account has been
              connected to Monai.
              <br />
              <br />
              We can now securely access your account balances and transaction
              history.
            </Typography>
          </Stack>
          <Button
            size='large'
            variant='contained'
            onClick={() => navigate(paths.dashboard)}
            fullWidth
          >
            Go to Dashboard
          </Button>
        </Stack>
      </Box>
    </Box>
  )
}

export default ConnectionSuccessful
