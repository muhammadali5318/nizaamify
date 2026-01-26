// FILE: src/pages/SignUp/components/SignupStepTwo.tsx
import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronLeft, ChevronRight } from '@mui/icons-material'
import { LoadingButton } from '@mui/lab'
import {
  Box,
  Stack,
  TextField,
  Typography,
  FormControl,
  FormHelperText,
  Button
} from '@mui/material'
import React from 'react'
import { useForm, Controller, Resolver } from 'react-hook-form'
import {
  SignupFormValues as StepTwoFormValues,
  SignupStepTwoSchema
} from 'src/schema-validations/signupStepTwoValidations'
import { StepPropsBase } from '../../types'
import FormHeader from '../FormHeader'

type Props = Pick<
  StepPropsBase,
  'formData' | 'setFormData' | 'onNext' | 'onBack' | 'activeStep'
>

const SignupStepTwo: React.FC<Props> = ({
  formData,
  setFormData,
  onNext,
  onBack,
  activeStep
}) => {
  const {
    control,
    handleSubmit,
    reset,
    getValues, // <-- added
    formState: { errors, isValid }
  } = useForm<StepTwoFormValues>({
    resolver: zodResolver(
      SignupStepTwoSchema
    ) as unknown as Resolver<StepTwoFormValues>,
    mode: 'onChange',
    defaultValues: {
      practiceName: formData.practiceName,
      street: formData.street,
      city: formData.city,
      postcode: formData.postcode,
      practiceEmail: formData.practiceEmail
    }
  })

  React.useEffect(() => {
    reset({
      practiceName: formData.practiceName,
      street: formData.street,
      city: formData.city,
      postcode: formData.postcode,
      practiceEmail: formData.practiceEmail
    })
  }, [formData, reset])

  const onSubmit = (data: StepTwoFormValues) => {
    setFormData({
      practiceName: data.practiceName,
      street: data.street,
      city: data.city,
      postcode: data.postcode,
      practiceEmail: data.practiceEmail
    })
    onNext?.()
  }

  // --- NEW: save current values without validating when navigating back ---
  const handleBackAndSave = () => {
    const values = getValues()
    const patch = {
      practiceName: values.practiceName ?? '',
      street: values.street ?? '',
      city: values.city ?? '',
      postcode: values.postcode ?? '',
      practiceEmail: values.practiceEmail ?? ''
    }
    setFormData(patch)
    onBack?.()
  }
  // --------------------------------------------------------------------

  return (
    <Box component='section'>
      <FormHeader activeStep={activeStep} />

      <Box
        component='form'
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        sx={{ mt: 2 }}
      >
        <Stack spacing={2.5}>
          <Controller
            name='practiceName'
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                required
                fullWidth
                label='Practice Name'
                error={!!errors.practiceName}
                helperText={errors.practiceName?.message}
              />
            )}
          />

          <Stack spacing={2}>
            <Typography variant='h6' className='font-weight--700'>
              Practice Address
            </Typography>

            <Controller
              name='street'
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  required
                  fullWidth
                  label='Street'
                  error={!!errors.street}
                  helperText={errors.street?.message}
                />
              )}
            />

            <Controller
              name='city'
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  required
                  fullWidth
                  label='Town/City'
                  error={!!errors.city}
                  helperText={errors.city?.message}
                />
              )}
            />

            <Controller
              name='postcode'
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  required
                  fullWidth
                  label='Postcode'
                  error={!!errors.postcode}
                  helperText={errors.postcode?.message}
                />
              )}
            />
          </Stack>

          <FormControl fullWidth error={!!errors.practiceEmail}>
            <Controller
              name='practiceEmail'
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  required
                  label='Practice Email Address'
                  type='email'
                  error={!!errors.practiceEmail}
                />
              )}
            />
            <FormHelperText>{errors.practiceEmail?.message}</FormHelperText>
          </FormControl>

          <Stack direction='row' justifyContent='space-between' sx={{ mt: 1 }}>
            <Button
              size='large'
              variant='outlined'
              color='primary'
              onClick={handleBackAndSave}
              startIcon={<ChevronLeft />}
            >
              Back
            </Button>
            <LoadingButton
              type='submit'
              size='large'
              variant='contained'
              color='primary'
              disabled={!isValid}
              endIcon={<ChevronRight />}
            >
              Next
            </LoadingButton>
          </Stack>
        </Stack>
      </Box>
    </Box>
  )
}

export default SignupStepTwo
