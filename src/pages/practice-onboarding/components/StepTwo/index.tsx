// FILE: src/pages/SignUp/components/SignupStepTwo.tsx
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
import { useUpdateStepTwo } from '../../hooks/useUpdateStepTwo'
import isEqual from 'lodash/isEqual'
import { useAuth0 } from '@auth0/auth0-react'
import { getUserOrgUuid } from 'src/utils/getActivePracticeId'
import { useNavigate } from 'react-router'
import { paths } from 'src/paths'
import SaveAndExitDialogue from '../SaveAndExitDialogue/SaveAndExitDialogue' // adjust path if needed

type StepTwoProps = {
  formData: StepTwoFormValues
  setFormData: (patch: Partial<StepTwoFormValues>) => void
  onNext?: (patch?: Partial<StepTwoFormValues>) => void
  onBack?: () => void
  activeStep: number
  onOpenNominate: () => void
}

const StepTwo: React.FC<StepTwoProps> = ({
  formData,
  setFormData,
  onNext,
  onBack,
  activeStep,
  onOpenNominate
}) => {
  const { user } = useAuth0()
  const orgUuid = getUserOrgUuid(user)
  const navigate = useNavigate()

  const updateStepTwo = useUpdateStepTwo(orgUuid)
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
      practiceType: formData.practiceType ?? '',
      yearsTrading: formData.yearsTrading ?? '',
      numberOfSurgeries: formData.numberOfSurgeries ?? '',
      numberOfAssociates: formData.numberOfAssociates ?? '',
      numberOfHygienistsTherapists: formData.numberOfHygienistsTherapists ?? '',
      numberOfSpecialists: formData.numberOfSpecialists ?? '',
      premisesOwnership: formData.premisesOwnership ?? ''
    }
  })

  React.useEffect(() => {
    reset({
      practiceType: formData.practiceType ?? '',
      yearsTrading: formData.yearsTrading ?? '',
      numberOfSurgeries: formData.numberOfSurgeries ?? '',
      numberOfAssociates: formData.numberOfAssociates ?? '',
      numberOfHygienistsTherapists: formData.numberOfHygienistsTherapists ?? '',
      numberOfSpecialists: formData.numberOfSpecialists ?? '',
      premisesOwnership: formData.premisesOwnership ?? ''
    })
  }, [formData, reset])

  // local modal state
  const [openDialog, setOpenDialog] = React.useState(false)
  const handleOpenDialog = () => setOpenDialog(true)
  const handleCloseDialog = () => setOpenDialog(false)

  const onSubmit = (data: StepTwoFormValues) => {
    const newValues: StepTwoFormValues = {
      practiceType: data.practiceType,
      yearsTrading: data.yearsTrading,
      numberOfSurgeries: data.numberOfSurgeries,
      numberOfAssociates: data.numberOfAssociates,
      numberOfHygienistsTherapists: data.numberOfHygienistsTherapists,
      numberOfSpecialists: data.numberOfSpecialists,
      premisesOwnership: data.premisesOwnership
    }

    if (isEqual(newValues, formData)) {
      onNext?.()
      return
    }

    setFormData(newValues)

    updateStepTwo.mutate(
      {
        practice_type: newValues.practiceType,
        years_of_trading: Number(newValues.yearsTrading),
        number_of_surgeries: Number(newValues.numberOfSurgeries),
        number_of_associates: Number(newValues.numberOfAssociates),
        number_of_hygienists_therapists: Number(
          newValues.numberOfHygienistsTherapists
        ),
        number_of_specialists: Number(newValues.numberOfSpecialists),
        premises_ownership: newValues.premisesOwnership
      },
      {
        onSuccess: () => {
          onNext?.(newValues)
        }
      }
    )
  }

  const handleSaveExit = () => {
    const onValid = (data: StepTwoFormValues) => {
      const newValues: StepTwoFormValues = {
        practiceType: data.practiceType,
        yearsTrading: data.yearsTrading,
        numberOfSurgeries: data.numberOfSurgeries,
        numberOfAssociates: data.numberOfAssociates,
        numberOfHygienistsTherapists: data.numberOfHygienistsTherapists,
        numberOfSpecialists: data.numberOfSpecialists,
        premisesOwnership: data.premisesOwnership
      }

      // if nothing changed, just navigate away
      if (isEqual(newValues, formData)) {
        navigate(paths.dashboard)
        return
      }

      setFormData(newValues)

      updateStepTwo.mutate(
        {
          practice_type: newValues.practiceType,
          years_of_trading: Number(newValues.yearsTrading),
          number_of_surgeries: Number(newValues.numberOfSurgeries),
          number_of_associates: Number(newValues.numberOfAssociates),
          number_of_hygienists_therapists: Number(
            newValues.numberOfHygienistsTherapists
          ),
          number_of_specialists: Number(newValues.numberOfSpecialists),
          premises_ownership: newValues.premisesOwnership
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

  const isSaving = updateStepTwo?.status === 'pending'

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
                  <MenuItem value='OWN'>Own</MenuItem>
                  <MenuItem value='RENT'>Rent</MenuItem>
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
              onClick={handleOpenDialog}
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
                loading={isSaving}
                endIcon={<ChevronRight />}
              >
                Next
              </LoadingButton>
            </Box>
          </Stack>
        </Stack>
      </Box>

      {/* Local Save & Exit dialog */}
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

export default StepTwo
