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
import { useUpdateStepFour } from '../../hooks/useUpdateStepFour'
import { isEqual } from 'lodash'
import { useAuth0 } from '@auth0/auth0-react'
import { getUserOrgUuid } from 'src/utils/getActivePracticeId'
import { useNavigate } from 'react-router'
import { paths } from 'src/paths'
import SaveAndExitDialogue from '../SaveAndExitDialogue/SaveAndExitDialogue'

type StepFourProps = {
  formData: FormValues
  setFormData: (patch: Partial<FormValues>) => void
  onBack?: () => void
  onSubmit?: (patch?: Partial<FormValues>) => void
  activeStep: number
  onNext?: (patch?: Partial<FormValues>) => void
  isSubmitting?: boolean
  serverErrors?: Record<string, string>
  onOpenNominate: () => void
}

const LEFT_REASONS = ['Track Profit', 'Save Time', 'Understand Performance']
const RIGHT_REASONS = ['Reduce Cost', 'Meet NHS Targets', 'Other']

const mapFrequencyToApi = (v: string) => v.toUpperCase()
const mapConfidenceToApi = (v: string) => v.toUpperCase()
const mapInsightsFormatToApi = (v: string) => v.toUpperCase()
const toTitleCase = (s: string) =>
  s
    .split(' ')
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
const mapPrimaryReasonsToApi = (reasons: string[]) =>
  reasons.map((r) => toTitleCase(r))

const StepFour: React.FC<StepFourProps> = ({
  formData,
  setFormData,
  onBack,
  activeStep,
  onNext,
  serverErrors = {},
  onOpenNominate
}) => {
  const { user } = useAuth0()
  const orgUuid = getUserOrgUuid(user)

  const updateStepFour = useUpdateStepFour(orgUuid)
  const isSaving = updateStepFour.status === 'pending'
  const navigate = useNavigate()

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
    const patchForParent = {
      frequencyOfFinancialReview: data.frequencyOfFinancialReview,
      primaryReasons: data.primaryReasons,
      confidenceReadingReports: data.confidenceReadingReports,
      preferredInsightsFormat: data.preferredInsightsFormat
    }

    if (isEqual(patchForParent, formData)) {
      onNext?.()
      return
    }

    setFormData(patchForParent)

    const payload = {
      financial_review_frequency: mapFrequencyToApi(
        data.frequencyOfFinancialReview
      ),
      primary_reasons: mapPrimaryReasonsToApi(data.primaryReasons ?? []),
      confidence_reading_reports: mapConfidenceToApi(
        data.confidenceReadingReports
      ),
      insights_format: mapInsightsFormatToApi(data.preferredInsightsFormat)
    }

    updateStepFour.mutate(payload, {
      onSuccess: () => {
        onNext?.(patchForParent)
      }
    })
  }

  // local dialog state + Save & Exit handler (with onInvalid behaviour)
  const [openDialog, setOpenDialog] = React.useState(false)
  const handleOpenDialog = () => setOpenDialog(true)
  const handleCloseDialog = () => setOpenDialog(false)

  const handleSaveExit = () => {
    const onValid = (data: FormValues) => {
      const patchForParent = {
        frequencyOfFinancialReview: data.frequencyOfFinancialReview,
        primaryReasons: data.primaryReasons,
        confidenceReadingReports: data.confidenceReadingReports,
        preferredInsightsFormat: data.preferredInsightsFormat
      }

      if (isEqual(patchForParent, formData)) {
        navigate(paths.dashboard)
        return
      }

      setFormData(patchForParent)

      const payload = {
        financial_review_frequency: mapFrequencyToApi(
          data.frequencyOfFinancialReview
        ),
        primary_reasons: mapPrimaryReasonsToApi(data.primaryReasons ?? []),
        confidence_reading_reports: mapConfidenceToApi(
          data.confidenceReadingReports
        ),
        insights_format: mapInsightsFormatToApi(data.preferredInsightsFormat)
      }

      updateStepFour.mutate(payload, {
        onSuccess: () => {
          navigate(paths.dashboard)
        }
      })
    }

    const onInvalid = () => {
      navigate(paths.dashboard)
      handleCloseDialog()
    }

    handleSubmit(onValid, onInvalid)()
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
                  <MenuItem value='MONTHLY'>Monthly</MenuItem>
                  <MenuItem value='YEARLY'>Yearly</MenuItem>
                  <MenuItem value='RARELY'>Rarely</MenuItem>
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
              Primary reasons for using Monai tech:
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
                  <MenuItem value='VERY CONFIDENT'>Very Confident</MenuItem>
                  <MenuItem value='CONFIDENT'>Confident</MenuItem>
                  <MenuItem value='NOT CONFIDENT'>Not Confident</MenuItem>
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
                  <MenuItem value='VISUAL DASHBOARDS'>
                    Visual Dashboards
                  </MenuItem>
                  <MenuItem value='BULLET-POINT SUMMARIES'>
                    Bullet-point summaries
                  </MenuItem>
                  <MenuItem value='DETAILED REPORTS'>Detailed Reports</MenuItem>
                </Select>
              )}
            />
            <FormHelperText>
              {errors.preferredInsightsFormat?.message as React.ReactNode}
            </FormHelperText>
          </FormControl>

          <Stack
            direction='row'
            justifyContent='space-between'
            alignItems='center'
            sx={{
              mt: 1,
              flexWrap: { xs: 'wrap', sm: 'nowrap' },
              gap: { xs: 1.5, sm: 0 },
              '@media (max-width: 380px)': {
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: 1.5
              }
            }}
          >
            <Button
              size='large'
              variant='outlined'
              color='primary'
              onClick={handleOpenDialog}
            >
              Save & exit
            </Button>

            <Box
              sx={{
                '@media (max-width: 380px)': {
                  display: 'flex',
                  justifyContent: 'space-between'
                }
              }}
            >
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
              <Button
                type='submit'
                size='large'
                variant='contained'
                color='primary'
                loading={isSaving}
                disabled={isSaving || !isValid || hasBlockingServerErrors}
                endIcon={<ChevronRight />}
              >
                Next
              </Button>
            </Box>
          </Stack>
        </Stack>
      </Box>

      {/* Local Save & Exit dialog */}
      <SaveAndExitDialogue
        open={openDialog}
        onClose={handleCloseDialog}
        onOpenNominate={() => {
          onOpenNominate()
          handleCloseDialog()
        }}
        onConfirm={() => {
          handleSaveExit()
        }}
        confirmLoading={isSaving}
      />
    </Box>
  )
}

export default StepFour
