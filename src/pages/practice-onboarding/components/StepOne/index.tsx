import React from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowDropDown, ChevronRight } from '@mui/icons-material'
import { MuiTelInput } from 'mui-tel-input'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import FormHeader from '../FormHeader'
import {
  StepOneFormValues,
  StepOneSchema
} from 'src/schema-validations/practice-onboarding/stepOne'
import { useUpdateStepOne } from '../../hooks/useUpdateStepOne'
import { isEqual } from 'lodash'
import { useAuth0 } from '@auth0/auth0-react'
import { getUserOrgUuid } from 'src/utils/getActivePracticeId'
import { useNavigate } from 'react-router'
import { paths } from 'src/paths'
import SaveAndExitDialogue from '../SaveAndExitDialogue/SaveAndExitDialogue'
import {
  Box,
  Stack,
  TextField,
  FormControl,
  FormHelperText,
  Button
} from '@mui/material'

type StepOneProps = {
  formData: StepOneFormValues
  setFormData: (patch: Partial<StepOneFormValues>) => void
  onNext?: (patch?: Partial<StepOneFormValues>) => void
  activeStep: number
  onOpenNominate: () => void
}

const StepOne: React.FC<StepOneProps> = ({
  formData,
  setFormData,
  onNext,
  activeStep,
  onOpenNominate
}) => {
  const { user } = useAuth0()
  const orgUuid = getUserOrgUuid(user)
  const navigate = useNavigate()

  const updateStepOne = useUpdateStepOne(orgUuid)
  const {
    control,
    handleSubmit,
    reset,
    formState: { isValid }
  } = useForm<StepOneFormValues>({
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

  React.useEffect(() => {
    reset({
      practiceName: formData.practiceName,
      principalName: formData.principalName,
      practiceManagerName: formData.practiceManagerName,
      practiceAddress: formData.practiceAddress,
      email: formData.email,
      phone: formData.phone
    })
  }, [formData, reset, user])

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

  // Local modal state
  const [openDialog, setOpenDialog] = React.useState(false)
  const handleOpenDialog = () => setOpenDialog(true)
  const handleCloseDialog = () => setOpenDialog(false)

  // Next (existing behavior)
  const onSubmit = (data: StepOneFormValues) => {
    const parsed = parsePhoneNumberFromString(data.phone || '')
    const normalizedPhone = parsed ? parsed.number : data.phone

    const newValues: StepOneFormValues = {
      practiceName: data.practiceName,
      principalName: data.principalName,
      practiceManagerName: data.practiceManagerName,
      practiceAddress: data.practiceAddress,
      email: data.email!,
      phone: normalizedPhone
    }

    if (isEqual(newValues, formData)) {
      onNext?.()
      return
    }

    setFormData(newValues)

    updateStepOne.mutate(
      {
        practice_name: data.practiceName,
        principal_name: data.principalName,
        practice_manager_name: data.practiceManagerName,
        address: data.practiceAddress,
        contact_number: normalizedPhone || '',
        email: data.email!
      },
      {
        onSuccess: () => {
          onNext?.()
        }
      }
    )
  }

  const handleSaveExit = () => {
    const onValid = (data: StepOneFormValues) => {
      const parsed = parsePhoneNumberFromString(data.phone || '')
      const normalizedPhone = parsed ? parsed.number : data.phone

      const newValues: StepOneFormValues = {
        practiceName: data.practiceName,
        principalName: data.principalName,
        practiceManagerName: data.practiceManagerName,
        practiceAddress: data.practiceAddress,
        email: data.email!,
        phone: normalizedPhone
      }

      // if nothing changed, just navigate
      if (isEqual(newValues, formData)) {
        navigate(paths.dashboard)
        return
      }

      setFormData(newValues)

      updateStepOne.mutate(
        {
          practice_name: data.practiceName,
          principal_name: data.principalName,
          practice_manager_name: data.practiceManagerName,
          address: data.practiceAddress,
          contact_number: normalizedPhone || '',
          email: data.email!
        },
        {
          onSuccess: () => {
            navigate(paths.dashboard)
          }
        }
      )
    }

    const onInvalid = () => {
      navigate(paths.dashboard)
      handleCloseDialog()
    }

    handleSubmit(onValid, onInvalid)()
  }

  const isSaving = updateStepOne?.status === 'pending'

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
                helperText={fieldState.error?.message}
                error={!!fieldState.error}
              />
            )}
          />

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{ marginTop: '20px !important' }}
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

          <Stack direction='row' justifyContent='space-between'>
            <Button
              size='large'
              variant='outlined'
              color='primary'
              onClick={handleOpenDialog}
            >
              Save & exit
            </Button>
            <Button
              type='submit'
              size='large'
              variant='contained'
              color='primary'
              loading={isSaving}
              disabled={!isValid}
              endIcon={<ChevronRight />}
            >
              Next
            </Button>
          </Stack>
        </Stack>
      </Box>

      <SaveAndExitDialogue
        open={openDialog}
        onClose={handleCloseDialog}
        onOpenNominate={() => {
          handleCloseDialog()
          onOpenNominate?.()
        }}
        onConfirm={() => {
          handleSaveExit()
        }}
        confirmLoading={isSaving}
      />
    </Box>
  )
}

export default StepOne
