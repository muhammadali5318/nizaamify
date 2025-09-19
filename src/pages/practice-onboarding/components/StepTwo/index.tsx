// FILE: src/pages/SignUp/components/StepTwo.tsx
import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronLeft, ChevronRight } from '@mui/icons-material'
import { LoadingButton } from '@mui/lab'
import {
  Box,
  Stack,
  TextField,
  FormControl,
  FormHelperText,
  Button,
  Select,
  MenuItem,
  InputLabel
} from '@mui/material'
import React from 'react'
import { useForm, Controller, Resolver } from 'react-hook-form'
import {
  StepTwoFormValues,
  StepTwoSchema
} from 'src/schema-validations/practice-onboarding/stepTwo'
import FormHeader from '../FormHeader'

type StepTwoProps = {
  formData: StepTwoFormValues
  setFormData: (patch: Partial<StepTwoFormValues>) => void
  onNext?: (patch?: Partial<StepTwoFormValues>) => void
  onBack?: () => void
  activeStep?: number
  onSaveExitClick: () => void
}

const StepTwo: React.FC<StepTwoProps> = ({
  formData,
  setFormData,
  onNext,
  onBack,
  activeStep,
  onSaveExitClick
}) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<StepTwoFormValues>({
    resolver: zodResolver(
      StepTwoSchema
    ) as unknown as Resolver<StepTwoFormValues>,
    mode: 'onChange',
    defaultValues: {
      practiceType: (formData as any).practiceType ?? '',
      yearsTrading: (formData as any).yearsTrading ?? '',
      numberOfSurgeries: (formData as any).numberOfSurgeries ?? '',
      numberOfAssociates: (formData as any).numberOfAssociates ?? '',
      numberOfHygienistsTherapists:
        (formData as any).numberOfHygienistsTherapists ?? '',
      numberOfSpecialists: (formData as any).numberOfSpecialists ?? '',
      premisesOwnership: (formData as any).premisesOwnership ?? ''
    }
  })

  React.useEffect(() => {
    reset({
      practiceType: (formData as any).practiceType ?? '',
      yearsTrading: (formData as any).yearsTrading ?? '',
      numberOfSurgeries: (formData as any).numberOfSurgeries ?? '',
      numberOfAssociates: (formData as any).numberOfAssociates ?? '',
      numberOfHygienistsTherapists:
        (formData as any).numberOfHygienistsTherapists ?? '',
      numberOfSpecialists: (formData as any).numberOfSpecialists ?? '',
      premisesOwnership: (formData as any).premisesOwnership ?? ''
    })
  }, [formData, reset])

  const onSubmit = (data: StepTwoFormValues) => {
    // cast to any because parent type may not yet include these keys
    setFormData({
      ...(data as unknown as Record<string, any>)
    })
    onNext?.(data as unknown as Partial<typeof data>)
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
          <Stack spacing={2} direction={'row'}>
            {/* Practice type (selectable dropdown) */}
            <FormControl fullWidth error={!!errors.practiceType}>
              <InputLabel id='practice-type-label'>Practice type *</InputLabel>
              <Controller
                name='practiceType'
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    labelId='practice-type-label'
                    label='Practice type *'
                    variant='outlined'
                  >
                    <MenuItem value='NHS'>NHS</MenuItem>
                    <MenuItem value='Private'>Private</MenuItem>
                    <MenuItem value='Mixed'>Mixed</MenuItem>
                    <MenuItem value='Other'>Other</MenuItem>
                  </Select>
                )}
              />
              <FormHelperText>
                {errors.practiceType?.message as React.ReactNode}
              </FormHelperText>
            </FormControl>

            {/* Years trading (number) */}
            <Controller
              name='yearsTrading'
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  required
                  fullWidth
                  label='Years trading *'
                  type='number'
                  inputProps={{ min: 0 }}
                  error={!!errors.yearsTrading}
                  helperText={errors.yearsTrading?.message}
                />
              )}
            />
          </Stack>

          <Stack spacing={2} direction={'row'}>
            {/* Number of surgeries (number) */}
            <Controller
              name='numberOfSurgeries'
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  required
                  fullWidth
                  label='Number of surgeries *'
                  type='number'
                  inputProps={{ min: 0 }}
                  error={!!errors.numberOfSurgeries}
                  helperText={errors.numberOfSurgeries?.message}
                />
              )}
            />

            {/* Number of associates (number) */}
            <Controller
              name='numberOfAssociates'
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  required
                  fullWidth
                  label='Number of associates *'
                  type='number'
                  inputProps={{ min: 0 }}
                  error={!!errors.numberOfAssociates}
                  helperText={errors.numberOfAssociates?.message}
                />
              )}
            />
          </Stack>
          <Stack spacing={2} direction={'row'}>
            {/* Number of hygienists/therapists (number) */}
            <Controller
              name='numberOfHygienistsTherapists'
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  required
                  fullWidth
                  label='Number of hygienists/therapists *'
                  type='number'
                  inputProps={{ min: 0 }}
                  error={!!errors.numberOfHygienistsTherapists}
                  helperText={errors.numberOfHygienistsTherapists?.message}
                />
              )}
            />

            {/* Number of specialists (number) */}
            <Controller
              name='numberOfSpecialists'
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  required
                  fullWidth
                  label='Number of specialists *'
                  type='number'
                  inputProps={{ min: 0 }}
                  error={!!errors.numberOfSpecialists}
                  helperText={errors.numberOfSpecialists?.message}
                />
              )}
            />
          </Stack>

          {/* Premises ownership (selectable dropdown) */}
          <FormControl fullWidth error={!!errors.premisesOwnership}>
            <InputLabel id='premises-ownership-label'>
              Premises ownership *
            </InputLabel>
            <Controller
              name='premisesOwnership'
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  labelId='premises-ownership-label'
                  label='Premises ownership *'
                  variant='outlined'
                >
                  <MenuItem value='Owned'>Owned</MenuItem>
                  <MenuItem value='Leased'>Leased</MenuItem>
                  <MenuItem value='Rented'>Rented</MenuItem>
                  <MenuItem value='Other'>Other</MenuItem>
                </Select>
              )}
            />
            <FormHelperText>
              {errors.premisesOwnership?.message as React.ReactNode}
            </FormHelperText>
          </FormControl>

          <Stack direction='row' justifyContent='space-between' sx={{ mt: 1 }}>
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

export default StepTwo
