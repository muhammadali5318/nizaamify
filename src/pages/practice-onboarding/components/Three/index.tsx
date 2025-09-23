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
import { useUpdateStepThree } from '../../hooks/useUpdateStepThree'
import isEqual from 'lodash/isEqual'
import { useAuth0 } from '@auth0/auth0-react'
import { getUserOrgUuid } from 'src/utils/getActivePracticeId'

type StepThreeProps = {
  formData: FormValues
  setFormData: (patch: Partial<FormValues>) => void
  onBack?: () => void
  onNext?: (patch?: Partial<FormValues>) => void
  onSubmit?: (patch?: Partial<FormValues>) => void
  activeStep: number
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
  const { user } = useAuth0()
  const orgUuid = getUserOrgUuid(user)

  const updateStepThree = useUpdateStepThree(orgUuid)
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid }
  } = useForm<FormValues>({
    resolver: zodResolver(StepThreeSchema),
    mode: 'onChange',
    defaultValues: {
      practiceManagementSoftware: formData.practiceManagementSoftware,
      accountingSoftware: formData.accountingSoftware,
      useOfAccountantBookkeeper: formData.useOfAccountantBookkeeper
    }
  })

  useEffect(() => {
    reset({
      practiceManagementSoftware: formData.practiceManagementSoftware,
      accountingSoftware: formData.accountingSoftware,
      useOfAccountantBookkeeper: formData.useOfAccountantBookkeeper
    })
  }, [formData, reset])

  const submit = (data: FormValues) => {
    const newValues: FormValues = {
      practiceManagementSoftware: data.practiceManagementSoftware,
      accountingSoftware: data.accountingSoftware,
      useOfAccountantBookkeeper: data.useOfAccountantBookkeeper
    }

    if (isEqual(newValues, formData)) {
      onNext?.()
      return
    }

    // update parent state immediately so UI reflects inputs
    setFormData(newValues)

    // build API payload (backend keys)
    const payload = {
      management_software: newValues.practiceManagementSoftware,
      accounting_software: newValues.accountingSoftware,
      accountant_bookkeeper_use: newValues.useOfAccountantBookkeeper
    }

    // call PATCH -> advance only on success
    updateStepThree.mutate(payload, {
      onSuccess: () => {
        onNext?.(newValues)
      },
      onError: (err) => {
        console.error('Step 3 save failed', err)
      }
    })
  }

  const isSaving = updateStepThree?.status === 'pending'

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
                  <MenuItem value='DENTALLY'>Dentally</MenuItem>
                  <MenuItem value='R4'>R4</MenuItem>
                  <MenuItem value='CARESTREAM'>careStream</MenuItem>
                  <MenuItem value='OTHER'>Other</MenuItem>
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
                  <MenuItem value='XERO'>Xero</MenuItem>
                  <MenuItem value='QUICKBOOKS'>QuickBooks</MenuItem>
                  <MenuItem value='OTHER'>Other</MenuItem>
                  <MenuItem value='NONE'>None</MenuItem>
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
                  <MenuItem value='INTERNAL'>Internal</MenuItem>
                  <MenuItem value='EXTERNAL'>External</MenuItem>
                  <MenuItem value='NONE'>None</MenuItem>
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
                loading={isSaving || isSubmitting}
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
