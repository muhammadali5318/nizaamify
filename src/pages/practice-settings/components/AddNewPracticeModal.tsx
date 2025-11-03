// AddPracticeDialog.tsx
import React, { useCallback, useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  CircularProgress,
  Stack
} from '@mui/material'
import { useForm, Controller, SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  SignupFormValues,
  SignupStepTwoSchema
} from 'src/schema-validations/signupStepTwoValidations'

interface AddPracticeDialogProps {
  open: boolean
  onClose: () => void
  onSave?: (values: SignupFormValues) => Promise<void>
}

/**
 * Dialog component
 */
const AddPracticeDialog: React.FC<AddPracticeDialogProps> = ({
  open,
  onClose,
  onSave
}) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid }
  } = useForm<SignupFormValues>({
    resolver: zodResolver(SignupStepTwoSchema),
    defaultValues: {
      practiceName: '',
      street: '',
      city: '',
      country: '',
      postcode: '',
      practiceEmail: ''
    },
    mode: 'onChange'
  })

  const [loading, setLoading] = useState(false)

  const handleClose = useCallback(() => {
    if (loading) return
    reset()
    onClose()
  }, [loading, reset, onClose])

  const onSubmit: SubmitHandler<SignupFormValues> = useCallback(
    async (data) => {
      if (!onSave) {
        reset()
        onClose()
        return
      }

      setLoading(true)
      try {
        await onSave(data)
        reset()
        onClose()
      } catch (err: any) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    },
    [onSave, reset, onClose]
  )

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth='sm'
      aria-labelledby='add-practice-dialog-title'
      slotProps={{
        paper: {
          sx: {
            py: '36px',
            px: { xs: 2, sm: 6 },
            borderRadius: '24px'
          }
        }
      }}
    >
      <DialogTitle sx={{ p: 0, mb: '12px' }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2.5
          }}
        >
          <img
            src='/assets/practice-selector-rounded.svg'
            alt='user invitation icon'
            style={{ width: 80, height: 80 }}
          />

          <Box>
            <Typography
              className='font-weight--700'
              sx={{
                typography: { xs: 'h6', sm: 'h5' }
              }}
            >
              Add new practice
            </Typography>
            <Typography variant='subtitle1' color='text.secondary'>
              Basic practice details{' '}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogContent sx={{ p: 0 }}>
          <Stack spacing={2.5} mt={1}>
            <Controller
              name='practiceName'
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label='Practice name'
                  fullWidth
                  required
                  error={!!errors.practiceName}
                  helperText={errors.practiceName?.message}
                />
              )}
            />

            <Stack spacing={2}>
              <Typography
                variant='h6'
                color='var(--color-primary-black)'
                fontWeight={700}
              >
                Practice address
              </Typography>

              <Controller
                name='street'
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label='Street'
                    fullWidth
                    required
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
                      label='City'
                      fullWidth
                      required
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
                      label='Country'
                      fullWidth
                      required
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
                    label='Postcode'
                    fullWidth
                    required
                    error={!!errors.postcode}
                    helperText={errors.postcode?.message}
                  />
                )}
              />
            </Stack>

            <Controller
              name='practiceEmail'
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label='Practice email address'
                  type='email'
                  fullWidth
                  required
                  error={!!errors.practiceEmail}
                />
              )}
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 0, mt: 2.5 }}>
          <Box sx={{ display: 'flex', gap: 2, width: '100%' }}>
            <Button
              variant='outlined'
              onClick={handleClose}
              disabled={loading}
              fullWidth
              size='large'
            >
              Cancel
            </Button>

            <Button
              type='submit'
              variant='contained'
              disabled={loading || !isValid}
              fullWidth
              size='large'
              startIcon={loading ? <CircularProgress size={16} /> : undefined}
              sx={{
                textTransform: 'none'
              }}
            >
              {loading ? 'Saving...' : 'Add practice'}
            </Button>
          </Box>
        </DialogActions>
      </form>
    </Dialog>
  )
}

export default React.memo(AddPracticeDialog)
