// FILE: src/pages/SignUp/components/Four.tsx
import React, { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Box,
  Stack,
  FormControl,
  FormHelperText,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Checkbox,
  FormControlLabel,
  Typography,
  Alert
} from '@mui/material'
import { ChevronLeft, ChevronRight } from '@mui/icons-material'
import FormHeader from '../FormHeader'
import {
  StepFourSchema,
  StepFourFormValues as FormValues
} from 'src/schema-validations/practice-onboarding/stepFour'
import { notify } from 'src/components/notistack/NotificationProvider'
import { LoadingButton } from '@mui/lab'

type StepFourProps = {
  formData: FormValues
  setFormData: (patch: Partial<FormValues>) => void
  onBack?: () => void
  onSubmit?: (patch?: Partial<FormValues>) => void
  activeStep?: number
  isSubmitting?: boolean
  serverErrors?: Record<string, string>
  onSaveExitClick: () => void
}

const LEFT_REASONS = ['Track profit', 'Save time', 'Understand performance']
const RIGHT_REASONS = ['Reduce cost', 'Meet NHS targets', 'Other']

const StepFour: React.FC<StepFourProps> = ({
  formData,
  setFormData,
  onBack,
  onSubmit,
  activeStep,
  isSubmitting = false,
  serverErrors = {},
  onSaveExitClick
}) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid }
  } = useForm<FormValues>({
    resolver: zodResolver(StepFourSchema),
    mode: 'onChange',
    defaultValues: {
      frequencyOfFinancialReview:
        (formData as any).frequencyOfFinancialReview ?? 'Monthly',
      primaryReasons: (formData as any).primaryReasons ?? [],
      confidenceReadingReports:
        (formData as any).confidenceReadingReports ?? 'Confident',
      preferredInsightsFormat:
        (formData as any).preferredInsightsFormat ?? 'Visual Dashboards'
    }
  })

  useEffect(() => {
    reset({
      frequencyOfFinancialReview:
        (formData as any).frequencyOfFinancialReview ?? 'Monthly',
      primaryReasons: (formData as any).primaryReasons ?? [],
      confidenceReadingReports:
        (formData as any).confidenceReadingReports ?? 'Confident',
      preferredInsightsFormat:
        (formData as any).preferredInsightsFormat ?? 'Visual Dashboards'
    })
  }, [formData, reset])

  useEffect(() => {
    if (serverErrors?.email) notify.error(serverErrors.email)
    if (serverErrors?.practice) notify.error(serverErrors.practice)
    if (serverErrors?.general) notify.error(serverErrors.general)
  }, [serverErrors])

  const submit = (data: FormValues) => {
    const patch = {
      frequencyOfFinancialReview: data.frequencyOfFinancialReview,
      primaryReasons: data.primaryReasons,
      confidenceReadingReports: data.confidenceReadingReports,
      preferredInsightsFormat: data.preferredInsightsFormat
    }

    setFormData(patch)
    // This is the final step submit in your flow — call parent's onSubmit
    onSubmit?.(patch)
  }

  const hasBlockingServerErrors =
    Boolean(serverErrors?.email) || Boolean(serverErrors?.practice)

  return (
    <Box>
      <FormHeader activeStep={activeStep} />

      <Box
        component='form'
        onSubmit={handleSubmit(submit)}
        noValidate
        sx={{ mt: 2 }}
      >
        <Stack spacing={2.5}>
          {/* Frequency of financial review */}
          <FormControl fullWidth error={!!errors.frequencyOfFinancialReview}>
            <InputLabel id='frequency-review-label'>
              Frequency of financial review *
            </InputLabel>
            <Controller
              name='frequencyOfFinancialReview'
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  labelId='frequency-review-label'
                  label='Frequency of financial review *'
                >
                  <MenuItem value='Monthly'>Monthly</MenuItem>
                  <MenuItem value='Quarterly'>Quarterly</MenuItem>
                  <MenuItem value='Rarely'>Rarely</MenuItem>
                </Select>
              )}
            />
            <FormHelperText>
              {errors.frequencyOfFinancialReview?.message as React.ReactNode}
            </FormHelperText>
          </FormControl>

          {/* Primary reasons for using monai */}
          <Box>
            <Typography variant='h6' className='font-weight--700'>
              Primary reasons for using monai:
            </Typography>

            <Controller
              name='primaryReasons'
              control={control}
              render={({ field }) => {
                const selected = field.value ?? []
                const toggle = (option: string) => {
                  const exists = selected.includes(option)
                  const next = exists
                    ? selected.filter((s: string) => s !== option)
                    : [...selected, option]
                  field.onChange(next)
                }

                return (
                  <Box
                    sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}
                  >
                    {/* Left column */}
                    <Stack spacing={1} sx={{ flex: 1 }}>
                      {LEFT_REASONS.map((label) => (
                        <FormControlLabel
                          key={label}
                          control={
                            <Checkbox
                              checked={selected.includes(label)}
                              onChange={() => toggle(label)}
                            />
                          }
                          label={label}
                        />
                      ))}
                    </Stack>

                    {/* Right column */}
                    <Stack spacing={1} sx={{ flex: 1 }}>
                      {RIGHT_REASONS.map((label) => (
                        <FormControlLabel
                          key={label}
                          control={
                            <Checkbox
                              checked={selected.includes(label)}
                              onChange={() => toggle(label)}
                            />
                          }
                          label={label}
                        />
                      ))}
                    </Stack>
                  </Box>
                )
              }}
            />
            <FormHelperText error>
              {errors.primaryReasons?.message as React.ReactNode}
            </FormHelperText>
          </Box>

          <Alert severity='info'>
            <Typography
              className='alert-info-text font-weight--500'
              component='div'
              sx={{ margin: 0 }}
            >
              Please select at least one reason.
            </Typography>
          </Alert>

          {/* Confidence reading reports */}
          <FormControl fullWidth error={!!errors.confidenceReadingReports}>
            <InputLabel id='confidence-reports-label'>
              Confidence reading reports *
            </InputLabel>
            <Controller
              name='confidenceReadingReports'
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  labelId='confidence-reports-label'
                  label='Confidence reading reports *'
                >
                  <MenuItem value='Confident'>Confident</MenuItem>
                  <MenuItem value='Not Confident'>Not Confident</MenuItem>
                  <MenuItem value='Very Confident'>Very Confident</MenuItem>
                </Select>
              )}
            />
            <FormHelperText>
              {errors.confidenceReadingReports?.message as React.ReactNode}
            </FormHelperText>
          </FormControl>

          {/* Preferred insights format */}
          <FormControl fullWidth error={!!errors.preferredInsightsFormat}>
            <InputLabel id='preferred-insights-label'>
              Preferred insights format *
            </InputLabel>
            <Controller
              name='preferredInsightsFormat'
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  labelId='preferred-insights-label'
                  label='Preferred insights format *'
                >
                  <MenuItem value='Visual Dashboards'>
                    Visual Dashboards
                  </MenuItem>
                  <MenuItem value='Bullet-point summaries'>
                    Bullet-point summaries
                  </MenuItem>
                  <MenuItem value='Detailed Reports'>Detailed Reports</MenuItem>
                </Select>
              )}
            />
            <FormHelperText>
              {errors.preferredInsightsFormat?.message as React.ReactNode}
            </FormHelperText>
          </FormControl>

          <Stack direction='row' justifyContent='space-between'>
            <Button
              size='large'
              variant='outlined'
              color='primary'
              onClick={onSaveExitClick}
            >
              Save & exit
            </Button>

            <Box>
              <Button
                size='large'
                variant='outlined'
                color='primary'
                onClick={onBack}
                sx={{
                  mr: '8px'
                }}
                startIcon={<ChevronLeft />}
              >
                Back
              </Button>

              <LoadingButton
                type='submit'
                size='large'
                variant='contained'
                color='primary'
                loading={isSubmitting}
                disabled={!isValid || hasBlockingServerErrors}
                endIcon={<ChevronRight />}
              >
                Next
              </LoadingButton>
            </Box>
          </Stack>
        </Stack>
      </Box>
    </Box>
  )
}

export default StepFour
