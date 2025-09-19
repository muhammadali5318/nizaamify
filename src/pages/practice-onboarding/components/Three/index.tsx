// FILE: src/pages/SignUp/components/SignupStepThree.tsx
import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronLeft, ChevronRight } from '@mui/icons-material'
import { LoadingButton } from '@mui/lab'
import {
  Box,
  Stack,
  FormControl,
  FormHelperText,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Alert,
  Typography
} from '@mui/material'
import React, { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import FormHeader from '../FormHeader'
import {
  StepThreeSchema,
  StepThreeFormValues as FormValues
} from 'src/schema-validations/practice-onboarding/stepThree'

type StepThreeProps = {
  formData: FormValues
  setFormData: (patch: Partial<FormValues>) => void
  onBack?: () => void
  onNext?: (patch?: Partial<FormValues>) => void
  onSubmit?: (patch?: Partial<FormValues>) => void
  activeStep?: number
  isSubmitting?: boolean
  serverErrors?: Record<string, string>
  onSaveExitClick: () => void
}

const StepThree: React.FC<StepThreeProps> = ({
  formData,
  setFormData,
  onBack,
  onNext,
  activeStep,
  isSubmitting = false,
  onSaveExitClick
}) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid }
  } = useForm<FormValues>({
    resolver: zodResolver(StepThreeSchema),
    mode: 'onChange',
    defaultValues: {
      practiceManagementSoftware:
        (formData as any).practiceManagementSoftware ?? 'EXACT',
      accountingSoftware: (formData as any).accountingSoftware ?? 'Xero',
      useOfAccountantBookkeeper:
        (formData as any).useOfAccountantBookkeeper ?? 'internal'
    }
  })

  useEffect(() => {
    reset({
      practiceManagementSoftware:
        (formData as any).practiceManagementSoftware ?? 'EXACT',
      accountingSoftware: (formData as any).accountingSoftware ?? 'Xero',
      useOfAccountantBookkeeper:
        (formData as any).useOfAccountantBookkeeper ?? 'internal'
    })
  }, [formData, reset])

  const submit = (data: FormValues) => {
    const patch = {
      practiceManagementSoftware: data.practiceManagementSoftware,
      accountingSoftware: data.accountingSoftware,
      useOfAccountantBookkeeper: data.useOfAccountantBookkeeper
    }

    setFormData(patch)

    // Advance to next step (Step Four). Use onNext (not onSubmit).
    onNext?.(patch)

    // If you wanted this step to perform final submission instead,
    // call onSubmit?.(patch) here (but your flow expects StepFour next).
  }

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
          {/* Practice management software */}
          <FormControl fullWidth error={!!errors.practiceManagementSoftware}>
            <InputLabel id='practice-management-software-label'>
              Practice management software *
            </InputLabel>
            <Controller
              name='practiceManagementSoftware'
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  labelId='practice-management-software-label'
                  label='Practice management software *'
                >
                  <MenuItem value='EXACT'>EXACT</MenuItem>
                  <MenuItem value='Dentally'>Dentally</MenuItem>
                  <MenuItem value='R4'>R4</MenuItem>
                  <MenuItem value='careStream'>careStream</MenuItem>
                  <MenuItem value='Other'>Other</MenuItem>
                </Select>
              )}
            />
            <FormHelperText>
              {errors.practiceManagementSoftware?.message as React.ReactNode}
            </FormHelperText>
          </FormControl>

          {/* Accounting software */}
          <FormControl fullWidth error={!!errors.accountingSoftware}>
            <InputLabel id='accounting-software-label'>
              Accounting software *
            </InputLabel>
            <Controller
              name='accountingSoftware'
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  labelId='accounting-software-label'
                  label='Accounting software *'
                >
                  <MenuItem value='Xero'>Xero</MenuItem>
                  <MenuItem value='QuickBooks'>QuickBooks</MenuItem>
                  <MenuItem value='Other'>Other</MenuItem>
                  <MenuItem value='None'>None</MenuItem>
                </Select>
              )}
            />
            <FormHelperText>
              {errors.accountingSoftware?.message as React.ReactNode}
            </FormHelperText>
          </FormControl>

          {/* Use of accountant/bookkeeper */}
          <FormControl fullWidth error={!!errors.useOfAccountantBookkeeper}>
            <InputLabel id='use-accountant-label'>
              Use of accountant/bookkeeper *
            </InputLabel>
            <Controller
              name='useOfAccountantBookkeeper'
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  labelId='use-accountant-label'
                  label='Use of accountant/bookkeeper *'
                >
                  <MenuItem value='internal'>internal</MenuItem>
                  <MenuItem value='external'>external</MenuItem>
                  <MenuItem value='None'>None</MenuItem>
                </Select>
              )}
            />
            <FormHelperText>
              {errors.useOfAccountantBookkeeper?.message as React.ReactNode}
            </FormHelperText>
          </FormControl>

          <Alert severity='info'>
            <Typography
              className='alert-info-text font-weight--500'
              component='div'
              sx={{ margin: 0 }}
            >
              Why do we need this information?
            </Typography>
            <Typography
              className='alert-info-text'
              component='div'
              sx={{ margin: 0 }}
            >
              Understanding your current systems helps us provide better
              integration options and more accurate financial insights tailored
              to your practice’s setup.
            </Typography>
          </Alert>

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
                disabled={!isValid}
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

export default StepThree
