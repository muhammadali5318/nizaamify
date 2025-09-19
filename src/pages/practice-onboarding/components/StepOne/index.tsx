// FILE: src/pages/SignUp/components/SignupStepOne.tsx
import React from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { LoadingButton } from '@mui/lab'
import { ArrowDropDown, ChevronRight } from '@mui/icons-material'
import { MuiTelInput } from 'mui-tel-input'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import FormHeader from '../FormHeader'
import {
  Box,
  Stack,
  TextField,
  FormControl,
  FormHelperText,
  Button
} from '@mui/material'
import {
  StepOneFormValues,
  StepOneSchema
} from 'src/schema-validations/practice-onboarding/stepOne'

type StepOneProps = {
  formData: StepOneFormValues
  setFormData: (patch: Partial<StepOneFormValues>) => void
  onNext?: (patch?: Partial<StepOneFormValues>) => void
  activeStep?: number
  onSaveExitClick: () => void
}

const StepOne: React.FC<StepOneProps> = ({
  formData,
  setFormData,
  onNext,
  activeStep,
  onSaveExitClick
}) => {
  const { control, handleSubmit, reset } = useForm<StepOneFormValues>({
    resolver: zodResolver(StepOneSchema),
    mode: 'onChange',
    defaultValues: {
      practiceName: formData.practiceName,
      principalName: formData.principalName,
      practiceManagerName: formData.practiceManagerName,
      practiceAddress: formData.practiceAddress,
      email: formData.email,
      phone: formData.phone
    }
  })

  // When parent formData changes (e.g. user navigates back), reset local form to those values
  React.useEffect(() => {
    reset({
      practiceName: formData.practiceName,
      principalName: formData.principalName,
      practiceManagerName: formData.practiceManagerName,
      practiceAddress: formData.practiceAddress,
      email: formData.email,
      phone: formData.phone
    })
  }, [formData, reset])

  const phoneWrapperRef = React.useRef<HTMLDivElement | null>(null)

  const openCountryDropdown = () => {
    const root = phoneWrapperRef.current as HTMLElement | null
    if (!root) return
    const flagEl = root.querySelector<HTMLElement>('.MuiTelInput-Flag')
    if (flagEl) flagEl.click()
  }

  const handleArrowKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openCountryDropdown()
    }
  }

  const onSubmit = (data: StepOneFormValues) => {
    const parsed = parsePhoneNumberFromString(data.phone || '')
    const normalizedPhone = parsed ? parsed.number : data.phone

    // update parent state so data persists when navigating between steps
    setFormData({
      practiceName: data.practiceName,
      principalName: data.principalName,
      practiceManagerName: data.practiceManagerName,
      practiceAddress: data.practiceAddress,
      email: data.email,
      phone: normalizedPhone
    })

    // then go to next step
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
          {/* Practice name */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name='practiceName'
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  fullWidth
                  variant='outlined'
                  label='Practice name'
                  required
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />

            {/* Principal & Practice Manager */}
            <Controller
              name='principalName'
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  fullWidth
                  variant='outlined'
                  label='Principal name'
                  required
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
          </Stack>

          <Controller
            name='practiceManagerName'
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                fullWidth
                variant='outlined'
                label='Practice manager name'
                required
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />

          {/* Practice address - 300 char textarea */}
          <Controller
            name='practiceAddress'
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                fullWidth
                variant='outlined'
                label='Practice address'
                required
                multiline
                rows={4}
                inputProps={{ maxLength: 300 }}
                helperText={
                  fieldState.error?.message ??
                  `${(field.value ?? '').length}/300`
                }
                error={!!fieldState.error}
              />
            )}
          />

          {/* Email & Contact Number */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{ marginTop: '6px !important' }}
          >
            <Controller
              name='phone'
              control={control}
              rules={{
                validate: (v: string) => {
                  if (!v) return 'Phone required'
                  const phone = parsePhoneNumberFromString(v)
                  return phone && phone.isValid()
                    ? true
                    : 'Please enter a valid phone number'
                }
              }}
              render={({ field, fieldState }) => (
                <FormControl fullWidth error={!!fieldState.error}>
                  <Box sx={{ position: 'relative' }} ref={phoneWrapperRef}>
                    <MuiTelInput
                      {...field}
                      fullWidth
                      required
                      label='Contact number'
                      variant='outlined'
                      defaultCountry='GB'
                      onlyCountries={['GB']}
                      placeholder='Enter phone number'
                      onChange={(val) => field.onChange(val ?? '')}
                      sx={{
                        '& .MuiTelInput-Flag': {
                          borderRadius: '50%',
                          width: 24,
                          height: 24,
                          overflow: 'hidden',
                          boxShadow: '0 0 0 2px rgba(0,0,0,0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        },
                        '& .MuiTelInput-Flag img': {
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          borderRadius: '50%'
                        },
                        '& .MuiInputBase-input': {
                          paddingLeft: '24px'
                        }
                      }}
                    />

                    <ArrowDropDown
                      onClick={openCountryDropdown}
                      onKeyDown={handleArrowKey}
                      role='button'
                      tabIndex={0}
                      aria-label='Open country list'
                      sx={{
                        position: 'absolute',
                        left: 54,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: 28,
                        color: 'text.secondary',
                        cursor: 'pointer',
                        pointerEvents: 'auto'
                      }}
                    />
                  </Box>

                  <FormHelperText>{fieldState.error?.message}</FormHelperText>
                </FormControl>
              )}
            />
            <Controller
              name='email'
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  fullWidth
                  variant='outlined'
                  label='Email'
                  type='email'
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
          </Stack>

          {/* Submit */}
          <Stack direction='row' justifyContent='space-between'>
            <Button
              size='large'
              variant='outlined'
              color='primary'
              onClick={onSaveExitClick}
            >
              Save & exit
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
          </Stack>
        </Stack>
      </Box>
    </Box>
  )
}

export default StepOne
