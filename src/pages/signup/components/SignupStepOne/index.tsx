import React from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Box,
  Stack,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Typography,
  Checkbox,
  FormControlLabel,
  Alert
} from '@mui/material'
import { LoadingButton } from '@mui/lab'
import { ChevronRight, ArrowDropDown } from '@mui/icons-material'
import { MuiTelInput } from 'mui-tel-input'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import styles from './SignupStepOne.module.scss'

import FormHeader from '../FormHeader'
import {
  SignupStepOneSchema,
  SignupStepOneFormValues as FormValues
} from 'src/schema-validations/signupStupOneValidations'
import { SignupStepOneProps } from '../../types'

const SignupStepOne: React.FC<SignupStepOneProps> = ({
  onNext,
  activeStep
}) => {
  const {
    control,
    handleSubmit,
    formState: { errors, isValid }
  } = useForm<FormValues>({
    resolver: zodResolver(SignupStepOneSchema),
    mode: 'onChange',
    defaultValues: {
      firstName: '',
      lastName: '',
      role: '',
      email: '',
      phone: '',
      isPracticeOwnerOrDirector: false
    }
  })

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

  const onSubmit = (data: FormValues) => {
    const parsed = parsePhoneNumberFromString(data.phone || '')
    const normalizedPhone = parsed ? parsed.number : data.phone
    // eslint-disable-next-line no-console
    console.log('submit payload:', { ...data, phone: normalizedPhone })
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
          {/* First & Last Name */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name='firstName'
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  fullWidth
                  variant='outlined'
                  label='First name'
                  required
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />

            <Controller
              name='lastName'
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  fullWidth
                  variant='outlined'
                  label='Last name'
                  required
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
          </Stack>

          <Box>
            {/* Role Select */}
            <FormControl fullWidth error={!!errors.role}>
              <InputLabel id='role-label'>Role *</InputLabel>
              <Controller
                name='role'
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    labelId='role-label'
                    label='Role *'
                    variant='outlined'
                  >
                    <MenuItem value='admin'>Company Director</MenuItem>
                    <MenuItem value='manager'>
                      Practice Owner/Principal
                    </MenuItem>
                  </Select>
                )}
              />
              <FormHelperText>{errors.role?.message}</FormHelperText>
            </FormControl>
            <Alert severity='info' className={styles.alertInfoContainer}>
              <Typography
                className={styles.alertInfoText}
                component='div'
                sx={{ margin: 0 }}
              >
                Only Practice Owners or Company Directors can register. If you
                have another role, please ask your Practice Owner to invite you.
              </Typography>
            </Alert>

            {/* Checkbox */}
            <Controller
              name='isPracticeOwnerOrDirector'
              control={control}
              render={({ field, fieldState }) => (
                <FormControl error={!!fieldState.error}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        {...field}
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                      />
                    }
                    label={
                      <Typography variant='body1'>
                        I am{' '}
                        <span className='info-main font-weight--700'>
                          Practice Owner
                        </span>{' '}
                        and/or{' '}
                        <span className='info-main font-weight--700'>
                          Company Director
                        </span>{' '}
                        *
                      </Typography>
                    }
                  />
                  <FormHelperText>{fieldState.error?.message}</FormHelperText>
                </FormControl>
              )}
            />
          </Box>

          {/* Email & Phone */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{ marginTop: '14px !important' }}
          >
            <Controller
              name='email'
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  fullWidth
                  variant='outlined'
                  label='Email'
                  required
                  type='email'
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />

            {/* Phone */}
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
                  {/* attach ref so we can locate the flag element inside MuiTelInput */}
                  <Box sx={{ position: 'relative' }} ref={phoneWrapperRef}>
                    <MuiTelInput
                      {...field}
                      fullWidth
                      required
                      label='Phone Number'
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
          </Stack>

          {/* Submit */}
          <Stack direction='row' justifyContent='flex-end'>
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

export default SignupStepOne
