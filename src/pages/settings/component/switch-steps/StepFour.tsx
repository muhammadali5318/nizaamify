import { Box, Button, Stack, Typography } from '@mui/material'
import { StepProps } from '../../type'
import styles from './switchSteps.module.scss'
import PageHeader from 'src/components/page-header'
import spinner from 'src/assets/spinnergif.gif'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import { useEffect, useRef, useState } from 'react'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import { useActivePractice } from 'src/hooks/useActivePractice'
import { useAppDispatch } from 'src/store/hooks'
import {
  selectAccountingBasisSwitchExportDataId,
  setAccountingBasisSwitchExportData
} from 'src/store/slices/accountingBasisSwitchSlice'
import { useSelector } from 'react-redux'

const POLLING_INTERVAL = 5000

const StepFour: React.FC<StepProps> = ({ onNext, onBack }) => {
  const dispatch = useAppDispatch()
  const { activePracticeId } = useActivePractice()
  const exportDataId = useSelector(selectAccountingBasisSwitchExportDataId)

  const [isCompleted, setIsCompleted] = useState(false)
  const [isFailed, setIsFailed] = useState(false)
  const [statusMessage, setStatusMessage] = useState('Processing...')
  const [isPolling, setIsPolling] = useState(true)

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isStoppedRef = useRef(false)

  const stopPolling = () => {
    isStoppedRef.current = true
    setIsPolling(false)

    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  const checkStatus = async () => {
    try {
      const url = endpoints.accountingBasis.exportPracticeDataStatus(
        activePracticeId ?? '',
        exportDataId ?? ''
      )

      const response = await apiClient.get(url)
      const data = response?.data?.data

      if (!data) {
        setStatusMessage('Waiting for export status...')
        return
      }

      if (data.status === 'COMPLETED') {
        dispatch(setAccountingBasisSwitchExportData(data))
        setIsCompleted(true)
        setIsFailed(false)
        setStatusMessage('Export completed. Please continue.')
        stopPolling()
        return
      }

      if (data.status === 'FAILED') {
        setIsFailed(true)
        setIsCompleted(false)
        setStatusMessage('Export failed. Please try again.')
        stopPolling()
        return
      }

      setStatusMessage('Processing...')
    } catch {
      setIsFailed(true)
      stopPolling()
      setStatusMessage('Unable to check export status right now.')
    }
  }

  useEffect(() => {
    isStoppedRef.current = false
    setIsCompleted(false)
    setIsFailed(false)
    setIsPolling(true)
    setStatusMessage('Processing...')

    if (!activePracticeId) {
      setStatusMessage('Missing export status reference.')
      stopPolling()
      return
    }

    checkStatus()

    pollingRef.current = setInterval(() => {
      if (!isStoppedRef.current) {
        checkStatus()
      }
    }, POLLING_INTERVAL)

    return () => {
      stopPolling()
    }
  }, [activePracticeId])

  const handleBackClick = () => {
    stopPolling()
    onBack()
  }

  return (
    <Box className={styles.stepTwoRoot}>
      <Box className={styles.stepFourContainer}>
        <Typography variant='subtitle1' color='text.secondary'>
          Step 4 of 5
        </Typography>

        <Stack spacing={2}>
          <PageHeader
            isDividerVisible={false}
            title='Exporting Your Data'
            logo='/assets/docs-export.svg'
          />

          <Box
            sx={{
              display: 'flex',
              p: 2,
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'flex-start',
              alignSelf: 'stretch',
              borderRadius: '20px',
              border: '1px solid',
              borderColor: isCompleted
                ? 'rgba(46, 125, 50, 0.35)'
                : isFailed
                  ? 'rgba(211, 47, 47, 0.35)'
                  : 'rgba(0, 0, 0, 0.20)',
              backgroundColor: isCompleted
                ? 'rgba(46, 125, 50, 0.06)'
                : isFailed
                  ? 'rgba(211, 47, 47, 0.06)'
                  : 'transparent'
            }}
          >
            <Box display='flex' gap={2} alignItems='flex-start'>
              <Box sx={{ mt: 0.25 }}>
                {isCompleted ? (
                  <CheckCircleOutlineIcon
                    sx={{ color: '#2e7d32', fontSize: 32 }}
                  />
                ) : isFailed ? (
                  <ErrorOutlineIcon sx={{ color: '#d32f2f', fontSize: 32 }} />
                ) : (
                  <img src='/assets/Info-outlined.svg' alt='info icon' />
                )}
              </Box>

              <Stack spacing={0.5}>
                <Typography
                  variant='h6'
                  fontWeight={500}
                  color={
                    isCompleted ? '#2e7d32' : isFailed ? '#d32f2f' : '#014361'
                  }
                >
                  {isCompleted
                    ? 'Your export is ready.'
                    : isFailed
                      ? 'Export could not be completed.'
                      : 'We’re securely preparing your historical data for download.'}
                </Typography>

                <Typography
                  variant='body1'
                  color={
                    isCompleted ? '#2e7d32' : isFailed ? '#d32f2f' : '#014361'
                  }
                >
                  {isCompleted
                    ? 'The export has been completed successfully. Please continue to the next step.'
                    : isFailed
                      ? 'Please try again or go back and restart the export.'
                      : 'This includes all financial records and dashboards, exported month by month.'}
                </Typography>

                <Box display='flex' alignItems='center' gap={1}>
                  {isPolling && !isCompleted && !isFailed && (
                    <img
                      className='icon-dimension--36'
                      src={spinner}
                      alt='processing icon'
                    />
                  )}

                  <Typography
                    fontWeight={500}
                    variant='subtitle2'
                    fontStyle='italic'
                    color={
                      isCompleted ? '#2e7d32' : isFailed ? '#d32f2f' : 'inherit'
                    }
                  >
                    {statusMessage}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          </Box>
        </Stack>

        <Stack direction='row' spacing={2} className={styles.actions}>
          <Button variant='outlined' onClick={handleBackClick}>
            Back
          </Button>

          <Button variant='contained' onClick={onNext} disabled={!isCompleted}>
            Continue
          </Button>
        </Stack>
      </Box>
    </Box>
  )
}

export default StepFour
