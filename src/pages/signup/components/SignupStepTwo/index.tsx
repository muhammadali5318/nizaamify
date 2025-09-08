import React from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Box,
  Stack,
  Button,
  TextField,
  FormControl,
  FormHelperText,
  Typography
} from '@mui/material'
import FormHeader from '../FormHeader'
import { ChevronLeft, ChevronRight } from '@mui/icons-material'
import { LoadingButton } from '@mui/lab'
import {
  SignupFormValues,
  SignupStepTwoSchema
} from 'src/schema-validations/signupStepTwoValidations'
import { SignupStepTwoProps } from '../../types'

const SignupStepTwo: React.FC<SignupStepTwoProps> = ({
  onNext,
  onBack,
  activeStep
}) => {
  const {
    control,
    handleSubmit,
    formState: { errors, isValid }
  } = useForm<SignupFormValues>({
    resolver: zodResolver(SignupStepTwoSchema),
    mode: 'onChange',
    defaultValues: {
      practiceName: '',
      street: '',
      city: '',
      country: '',
      postcode: '',
      practiceEmail: ''
    }
  })

  const onSubmit = (data: SignupFormValues) => {
    // eslint-disable-next-line no-console
    console.log('Form submitted:', data)
    onNext?.()
  }

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

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Controller
                name='city'
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    required
                    fullWidth
                    label='City'
                    error={!!errors.city}
                    helperText={errors.city?.message}
                  />
                )}
              />

              <Controller
                name='country'
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    required
                    fullWidth
                    label='Country'
                    error={!!errors.country}
                    helperText={errors.country?.message}
                  />
                )}
              />
            </Stack>

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
              onClick={onBack}
              loadingPosition='end'
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
              loading={false}
              loadingPosition='end'
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
