// src/components/settings/PracticeInformation.tsx
import React, { useRef, useState } from 'react'
import {
  Box,
  Stack,
  Typography,
  TextField,
  FormControl,
  FormHelperText,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Divider,
  Button
} from '@mui/material'
import { CONFIG } from 'src/config-global'
import { ArrowDropDown } from '@mui/icons-material'
import { useForm, Controller, Resolver, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { MuiTelInput } from 'mui-tel-input'
import { usePractice, useUpdatePractice } from '../hooks/usePracticeProfile'
import {
  PracticeFormValues,
  PracticeSchema
} from 'src/schema-validations/practice-profile'
import {
  mapPracticeApiToForm,
  LEFT_REASONS,
  RIGHT_REASONS
} from '../setting-config'
import { notify } from 'src/components/notistack/NotificationProvider'
import AccountingBasisCard from './AccountingBasisInfo'
import { ACCRUAL_BASIS_INFO, CASH_BASIS_INFO } from 'src/const'
import { queryClient } from 'src/utils/queryClient'
import { useActivePractice } from 'src/hooks/useActivePractice'
import SwitchAccountingModal from './switch-accounting'
import { useAppDispatch } from 'src/store/hooks'
import {
  clearPendingPracticePayload,
  setPendingPracticePayload
} from 'src/store/slices/practiceAccountingBasisSlice'

const PracticeInformation = () => {
  const [openModal, setOpenModal] = useState(false)
  const phoneWrapperRef = useRef<HTMLDivElement | null>(null)
  const originalAccountingBasisRef = useRef<string>('')

  const dispatch = useAppDispatch()
  const { activePracticeId } = useActivePractice()
  const { data: practiceApi } = usePractice(activePracticeId ?? '')
  const updatePractice = useUpdatePractice(activePracticeId ?? '')

  const typedResolver = zodResolver(PracticeSchema) as Resolver<
    PracticeFormValues,
    any
  >

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isValid, isDirty },
    reset
  } = useForm<PracticeFormValues>({
    resolver: typedResolver,
    defaultValues: {
      practiceName: '',
      principalName: '',
      practiceManagerName: '',
      practiceAddress: '',
      phone: '',
      email: '',
      practiceType: '',
      yearsTrading: 0,
      numberOfSurgeries: 0,
      numberOfAssociates: 0,
      numberOfHygienistsTherapists: 0,
      numberOfSpecialists: 0,
      premisesOwnership: '',
      practiceManagementSoftware: '',
      accountingSoftware: '',
      useOfAccountantBookkeeper: '',
      frequencyOfFinancialReview: '',
      primaryReasons: [],
      confidenceReadingReports: '',
      preferredInsightsFormat: '',
      accountingBasis: ''
    } as unknown as PracticeFormValues,
    mode: 'onChange'
  })

  React.useEffect(() => {
    if (practiceApi) {
      const mapped = mapPracticeApiToForm(practiceApi)
      reset(mapped, { keepDefaultValues: false })
      originalAccountingBasisRef.current = mapped.accountingBasis ?? ''
    }
  }, [practiceApi, reset])

  const closeModal = () => {
    setOpenModal(false)
    dispatch(clearPendingPracticePayload())
  }

  const savePractice = async (values: PracticeFormValues) => {
    await updatePractice.mutateAsync(values)

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['initialData'] }),
      queryClient.invalidateQueries({ queryKey: ['listAllPracticesData'] }),
      queryClient.invalidateQueries({
        queryKey: ['UserWithActivePracticeData']
      })
    ])
  }

  const onSubmit = async (values: PracticeFormValues) => {
    try {
      const accountingBasisChanged =
        values.accountingBasis !== originalAccountingBasisRef.current

      if (accountingBasisChanged) {
        dispatch(setPendingPracticePayload(values))
        setOpenModal(true)
        return
      }

      await savePractice(values)
      notify.success('Practice information updated successfully')
    } catch (err) {
      notify.error('Failed to update practice information')
      throw err
    }
  }

  const openCountryDropdown = () => {
    phoneWrapperRef.current?.querySelector('input')?.focus()
  }
  const handleArrowKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openCountryDropdown()
    }
  }

  const accountingBasis = useWatch({
    control,
    name: 'accountingBasis'
  })

  return (
    <Box
      component='form'
      onSubmit={handleSubmit(onSubmit)}
      sx={{ width: '100%' }}
    >
      <Stack spacing={2.5}>
        <Stack spacing={2}>
          <Typography variant='h6' className='font-weight--700'>
            Practice details
          </Typography>

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
                slotProps={{
                  input: {
                    inputProps: {
                      maxLength: 300
                    }
                  }
                }}
                helperText={fieldState.error?.message}
                error={!!fieldState.error}
              />
            )}
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name='phone'
              control={control}
              render={({ field, fieldState }) => (
                <FormControl fullWidth error={!!fieldState.error}>
                  <Box sx={{ position: 'relative' }} ref={phoneWrapperRef}>
                    <MuiTelInput
                      {...field}
                      fullWidth
                      required
                      label='Contact number'
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
                          boxShadow: '0 0 0 2px rgba(0,0,0,0.06)',
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
                  <FormHelperText>
                    {fieldState.error?.message ?? ''}
                  </FormHelperText>
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
                  required
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
          </Stack>
        </Stack>

        <Divider />

        <Stack spacing={2}>
          <Typography variant='h6' className='font-weight--700'>
            Practice profile
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
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
                    <MenuItem value='NHS-DOMINANT'>Predominantly NHS</MenuItem>
                    <MenuItem value='PRIVATE'>Private</MenuItem>
                    <MenuItem value='MIXED'>Mixed</MenuItem>
                    <MenuItem value='SQUAT'>Squat</MenuItem>
                  </Select>
                )}
              />
              <FormHelperText>
                {errors.practiceType?.message as React.ReactNode}
              </FormHelperText>
            </FormControl>

            <Controller
              name='yearsTrading'
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  required
                  fullWidth
                  label='Years trading'
                  type='number'
                  slotProps={{
                    input: {
                      inputProps: { min: 0 }
                    }
                  }}
                  error={!!errors.yearsTrading}
                  helperText={errors.yearsTrading?.message as React.ReactNode}
                />
              )}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name='numberOfSurgeries'
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  required
                  fullWidth
                  label='Number of surgeries'
                  type='number'
                  slotProps={{
                    input: {
                      inputProps: { min: 0 }
                    }
                  }}
                  error={!!errors.numberOfSurgeries}
                  helperText={
                    errors.numberOfSurgeries?.message as React.ReactNode
                  }
                />
              )}
            />
            <Controller
              name='numberOfAssociates'
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  required
                  fullWidth
                  label='Number of associates'
                  type='number'
                  slotProps={{
                    input: {
                      inputProps: { min: 0 }
                    }
                  }}
                  error={!!errors.numberOfAssociates}
                  helperText={
                    errors.numberOfAssociates?.message as React.ReactNode
                  }
                />
              )}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name='numberOfHygienistsTherapists'
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  required
                  fullWidth
                  label='Number of hygienists/therapists'
                  type='number'
                  slotProps={{
                    input: {
                      inputProps: { min: 0 }
                    }
                  }}
                  error={!!errors.numberOfHygienistsTherapists}
                  helperText={
                    errors.numberOfHygienistsTherapists
                      ?.message as React.ReactNode
                  }
                />
              )}
            />
            <Controller
              name='numberOfSpecialists'
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  required
                  fullWidth
                  label='Number of specialists'
                  type='number'
                  slotProps={{
                    input: {
                      inputProps: { min: 0 }
                    }
                  }}
                  error={!!errors.numberOfSpecialists}
                  helperText={
                    errors.numberOfSpecialists?.message as React.ReactNode
                  }
                />
              )}
            />
          </Stack>

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
                  label='Premises ownership'
                >
                  <MenuItem value='OWN'>Own</MenuItem>
                  <MenuItem value='RENT'>Rent</MenuItem>
                </Select>
              )}
            />
            <FormHelperText>
              {errors.premisesOwnership?.message as React.ReactNode}
            </FormHelperText>
          </FormControl>
        </Stack>

        <Divider />

        <Stack spacing={2}>
          <Typography variant='h6' className='font-weight--700'>
            Practice systems
          </Typography>

          <Stack spacing={2}>
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
          </Stack>
        </Stack>

        <Divider />

        <Stack spacing={2}>
          <Typography variant='h6' className='font-weight--700'>
            Financial habits & preferences
          </Typography>

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

          <Box>
            <Typography
              variant='subtitle1'
              className='font-weight--700'
              sx={{ mb: 1 }}
            >
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
                    sx={{
                      display: 'flex',
                      flexDirection: { xs: 'column', sm: 'row' },
                      gap: { xs: 2, sm: 6 },
                      alignItems: 'flex-start',
                      flexWrap: 'wrap'
                    }}
                  >
                    <Stack sx={{ flex: 1, minWidth: { xs: '100%', sm: '0' } }}>
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

                    <Stack sx={{ flex: 1, minWidth: { xs: '100%', sm: '0' } }}>
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
        </Stack>

        <Divider />

        {CONFIG.envName === 'dev' && (
          <Stack spacing={2}>
            <Typography variant='h6' className='font-weight--700'>
              Accounting settings
            </Typography>

            <FormControl fullWidth error={!!errors.accountingBasis}>
              <InputLabel id='accounting-basis-label'>
                Accounting basis
              </InputLabel>
              <Controller
                name='accountingBasis'
                control={control}
                render={({ field }) => (
                  <Select
                    required
                    {...field}
                    labelId='accounting-basis-label'
                    label='Accounting basis *'
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value)}
                  >
                    <MenuItem value='CASH'>Cash basis</MenuItem>
                    <MenuItem value='ACCRUAL'>Accrual basis</MenuItem>
                  </Select>
                )}
              />
              <FormHelperText>
                {errors.accountingBasis?.message as React.ReactNode}
              </FormHelperText>
            </FormControl>

            {accountingBasis === 'CASH' && (
              <AccountingBasisCard data={CASH_BASIS_INFO} />
            )}

            {accountingBasis === 'ACCRUAL' && (
              <AccountingBasisCard data={ACCRUAL_BASIS_INFO} />
            )}
          </Stack>
        )}

        <Box>
          <Button
            type='submit'
            size='large'
            variant='contained'
            loading={isSubmitting || updatePractice.isPending}
            disabled={!isDirty || !isValid || isSubmitting}
          >
            Save
          </Button>
        </Box>
      </Stack>

      <SwitchAccountingModal
        open={openModal}
        onClose={closeModal}
        selectedAccountingBasis={accountingBasis}
      />
    </Box>
  )
}

export default PracticeInformation
