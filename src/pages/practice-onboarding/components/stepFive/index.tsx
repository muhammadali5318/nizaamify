// src/pages/SignUp/components/stepFive.tsx
import React, { useEffect } from 'react'
import { useForm, Controller, SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Box,
  Stack,
  FormControl,
  FormHelperText,
  Button,
  Typography,
  Alert
} from '@mui/material'
import { ChevronLeft, ChevronRight } from '@mui/icons-material'
import { useAuth0 } from '@auth0/auth0-react'
import { getUserOrgUuid } from 'src/utils/getActivePracticeId'
import { useNavigate } from 'react-router'
import { paths } from 'src/paths'
import FormHeader from '../FormHeader'
import { notify } from 'src/components/notistack/NotificationProvider'
import SaveAndExitDialogue from '../SaveAndExitDialogue/SaveAndExitDialogue'
import useUpdateStepFive from '../../hooks/useUpdateStepFive'
import {
  StepFiveFormValues,
  stepFiveSchema
} from 'src/schema-validations/practice-onboarding/stepFive'
import RadioCard from 'src/components/radio-card'

type StepFiveProps = {
  formData: Partial<StepFiveFormValues>
  setFormData: (patch: Partial<StepFiveFormValues>) => void
  onBack?: () => void
  onSubmit?: (patch?: Partial<StepFiveFormValues>) => void
  activeStep: number
  onNext?: (patch?: Partial<StepFiveFormValues>) => void
  isSubmitting?: boolean
  serverErrors?: Record<string, string>
  onOpenNominate: () => void
}

/**
 * Reusable radio-card component
 */

const StepFive: React.FC<StepFiveProps> = ({
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
  const updateStep = useUpdateStepFive(orgUuid)
  const isSaving = updateStep.status === 'pending'
  const navigate = useNavigate()

  const defaultAccountingBasis = (formData?.accountingBasis ??
    '') as StepFiveFormValues['accountingBasis']

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid }
  } = useForm<StepFiveFormValues>({
    resolver: zodResolver(stepFiveSchema),
    mode: 'onChange',
    defaultValues: {
      accountingBasis: defaultAccountingBasis
    }
  })

  useEffect(() => {
    reset({
      accountingBasis: (formData?.accountingBasis ??
        '') as StepFiveFormValues['accountingBasis']
    })
  }, [formData, reset])

  useEffect(() => {
    if (serverErrors?.email) notify.error(serverErrors.email)
    if (serverErrors?.practice) notify.error(serverErrors.practice)
    if (serverErrors?.general) notify.error(serverErrors.general)
  }, [serverErrors])

  const submit: SubmitHandler<StepFiveFormValues> = (data) => {
    const patchForParent: Partial<StepFiveFormValues> = {
      accountingBasis: data.accountingBasis
    }

    setFormData(patchForParent)

    const payload = {
      accounting_basis: data.accountingBasis
        ? data.accountingBasis.toUpperCase()
        : ''
    }
    updateStep.mutate(payload, {
      onSuccess: () => onNext?.(patchForParent)
    })
  }

  const [openDialog, setOpenDialog] = React.useState(false)
  const handleOpenDialog = () => setOpenDialog(true)
  const handleCloseDialog = () => setOpenDialog(false)

  const handleSaveExit = () => {
    const onValid: SubmitHandler<StepFiveFormValues> = (data) => {
      const patchForParent: Partial<StepFiveFormValues> = {
        accountingBasis: data.accountingBasis
      }

      setFormData(patchForParent)

      const payload = {
        accounting_basis: data.accountingBasis
          ? data.accountingBasis.toUpperCase()
          : ''
      }

      updateStep.mutate(payload, {
        onSuccess: () => navigate(paths.dashboard)
      })
    }

    const onInvalid = () => {
      // still allow Save & Exit even if invalid
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
          <FormControl
            component='fieldset'
            error={Boolean(errors.accountingBasis)}
          >
            <Typography variant='h6' fontWeight={600}>
              Select your accounting basis
            </Typography>

            {/* Controller wraps the custom cards */}
            <Controller
              name='accountingBasis'
              control={control}
              render={({ field }) => {
                const selectedValue =
                  field.value as StepFiveFormValues['accountingBasis']

                return (
                  <>
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={2}
                      sx={{ mt: 1 }}
                    >
                      <RadioCard
                        value='cash'
                        selectedValue={selectedValue}
                        onSelect={(v) => field.onChange(v)}
                        header='Cash basis'
                        description='Income and expenses are recorded when cash actually moves, that is, when you receive or make payments. Ideal for smaller or newer practices that want to track real-time cash flow and keep things simple.'
                        bullets={[
                          'A real-time view of your actual cash position',
                          'Easier reconciliation with bank statements',
                          'Simpler tax reporting and bookkeeping',
                          'AI processing based on paid invoices only'
                        ]}
                        alertText='Your practice records revenue only when payment is received and expenses only when bills are paid.'
                        data-testid='radio-card-cash'
                      />

                      <RadioCard
                        value='accrual'
                        selectedValue={selectedValue}
                        onSelect={(v) => field.onChange(v)}
                        header='Accrual basis'
                        description='Income and expenses are recorded when they’re earned or incurred, even if the payment hasn’t been made yet. Ideal for established practices that want deeper financial insights and long-term performance tracking.'
                        bullets={[
                          'A full picture of expected income and liabilities',
                          'Advanced trend analysis and AI forecasting',
                          'Benchmarking accuracy aligned with NHS and Monai averages',
                          'AI processing for both paid and unpaid invoices'
                        ]}
                        alertText='Your practice tracks invoices and bills at the time they’re issued, not when cash is received or paid.'
                        data-testid='radio-card-accrual'
                      />
                    </Stack>

                    {errors.accountingBasis && (
                      <FormHelperText sx={{ mt: 1 }}>
                        {errors.accountingBasis.message}
                      </FormHelperText>
                    )}
                  </>
                )
              }}
            />
          </FormControl>

          <Alert severity='info' className='alert-info-container'>
            <Typography
              className='alert-info-text font-weight--500'
              component='div'
              sx={{ margin: 0 }}
            >
              Not sure which to choose?
            </Typography>
            <Typography
              className='alert-info-text'
              variant='body2'
              component='div'
              sx={{ margin: 0 }}
            >
              Most practices start with Cash Basis for simplicity. You can
              change this later from Practice Settings if your accounting method
              evolves.
            </Typography>
          </Alert>

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
                sx={{ mr: '8px' }}
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
                Done
              </Button>
            </Box>
          </Stack>
        </Stack>
      </Box>

      {/* Save & Exit dialog */}
      <SaveAndExitDialogue
        open={openDialog}
        onClose={handleCloseDialog}
        onOpenNominate={() => {
          onOpenNominate()
          handleCloseDialog()
        }}
        onConfirm={handleSaveExit}
        confirmLoading={isSaving}
      />
    </Box>
  )
}

export default StepFive
