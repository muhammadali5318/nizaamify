import { Box, Button, Stack, Typography } from '@mui/material'
import { StepProps } from '../../type'
import styles from './switchSteps.module.scss'
import PageHeader from 'src/components/page-header'
import { z } from 'zod'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import OTP from 'src/components/otp-field/OTP'
import { useActivePractice } from 'src/hooks/useActivePractice'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import useUserDetails from 'src/hooks/useUserDetails'
import { useAppDispatch } from 'src/store/hooks'
import { setAccountingBasisSwitchExportMeta } from 'src/store/slices/accountingBasisSwitchSlice'

const OtpSchema = z.object({
  otp: z.string().min(6).max(6)
})

type OtpFormValues = z.infer<typeof OtpSchema>

const RESEND_COOLDOWN = 59

const StepThree: React.FC<StepProps> = ({ onNext, onBack }) => {
  const dispatch = useAppDispatch()
  const { activePracticeId } = useActivePractice()
  const { email } = useUserDetails()

  const [otpError, setOtpError] = useState<string | null>(null)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const {
    control,
    handleSubmit,
    clearErrors,
    setError,
    formState: { isValid, isDirty, errors }
  } = useForm<OtpFormValues>({
    resolver: zodResolver(OtpSchema),
    mode: 'onChange',
    defaultValues: {
      otp: ''
    }
  })

  const startTimer = () => {
    setSecondsLeft(RESEND_COOLDOWN)

    if (timerRef.current) clearInterval(timerRef.current)

    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          timerRef.current = null
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  useEffect(() => {
    startTimer()

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const onSubmit = async (data: OtpFormValues) => {
    try {
      setIsVerifyingOtp(true)
      setOtpError(null)
      clearErrors('otp')

      await apiClient.post(
        endpoints.accountingBasis.verifyOtp(activePracticeId ?? ''),
        {
          email,
          otp_code: data.otp
        }
      )

      const response = await apiClient.get(
        endpoints.accountingBasis.exportPracticeData(activePracticeId ?? '')
      )

      // store both meta and full data if API returns them
      if (
        response?.data?.data?.export_data_id &&
        response?.data?.data?.status_url
      ) {
        dispatch(
          setAccountingBasisSwitchExportMeta({
            export_data_id: response?.data?.data?.export_data_id,
            status_url: response?.data?.data?.status_url
          })
        )
      }

      onNext()
    } catch {
      const msg = 'Invalid OTP. Please try again.'
      setOtpError(msg)
      setError('otp', { type: 'manual', message: msg })
    } finally {
      setIsVerifyingOtp(false)
    }
  }

  const handleResend = async () => {
    if (secondsLeft > 0 || isResending) return

    try {
      setIsResending(true)
      setOtpError(null)

      await apiClient.post(
        endpoints.accountingBasis.sendOtp(activePracticeId ?? ''),
        {
          email
        }
      )

      startTimer()
    } catch {
      setOtpError('Failed to resend OTP. Try again.')
    } finally {
      setIsResending(false)
    }
  }

  const resendDisabled = secondsLeft > 0 || isResending

  return (
    <Box className={styles.stepTwoRoot}>
      <Box className={styles.container}>
        <Typography variant='subtitle1' color='text.secondary'>
          Step 3 of 5
        </Typography>

        <Stack spacing={2}>
          <PageHeader
            isDividerVisible={false}
            title='Verify Your Identity'
            description={
              <>
                We have sent a one-time code to{' '}
                <span
                  style={{
                    fontWeight: '700',
                    fontStyle: 'italic',
                    color: '#000'
                  }}
                >
                  {email}
                </span>
              </>
            }
            logo='/assets/security.svg'
          />

          <Stack spacing={2}>
            <Typography variant='subtitle1' fontWeight={700}>
              Enter Your One-Time Code
            </Typography>

            <Controller
              name='otp'
              control={control}
              render={({ field }) => (
                <Box>
                  <OTP
                    value={field.value}
                    onChange={(val) => {
                      field.onChange(val)
                      if (otpError) setOtpError(null)
                      if (errors.otp) clearErrors('otp')
                    }}
                  />

                  {(errors.otp || otpError) && (
                    <Typography variant='caption' color='error' mt={1}>
                      {errors.otp?.message || otpError}
                    </Typography>
                  )}
                </Box>
              )}
            />

            <Box display='flex' alignItems='center' gap={25}>
              <Typography variant='subtitle1' color='text.secondary'>
                Didn’t receive the code?
              </Typography>

              {secondsLeft > 0 ? (
                <Typography variant='subtitle1' fontWeight={700}>
                  Resend in {secondsLeft}s
                </Typography>
              ) : (
                <Typography
                  variant='subtitle1'
                  color='info.main'
                  fontWeight={700}
                  sx={{
                    cursor: resendDisabled ? 'not-allowed' : 'pointer',
                    opacity: resendDisabled ? 0.6 : 1
                  }}
                  onClick={handleResend}
                >
                  Resend code
                </Typography>
              )}
            </Box>
          </Stack>
        </Stack>

        <Stack direction='row' spacing={2} className={styles.stepThreeActions}>
          <Button variant='outlined' onClick={onBack}>
            Cancel
          </Button>

          <Button
            variant='contained'
            onClick={handleSubmit(onSubmit)}
            disabled={!isDirty || !isValid || isVerifyingOtp}
          >
            {isVerifyingOtp ? 'Verifying...' : 'Continue'}
          </Button>
        </Stack>
      </Box>
    </Box>
  )
}

export default StepThree
