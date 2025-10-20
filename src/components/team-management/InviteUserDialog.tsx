import React, { useCallback } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  CircularProgress
} from '@mui/material'
import { useForm, Controller, SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  type InviteUserFormData,
  type UserRole
} from './common/team-management'
import { USER_ROLES } from 'src/const'

const inviteUserSchema = z.object({
  email: z
    .string()
    .nonempty('Email is required')
    .pipe(z.email('Please enter a valid email')),
  role: z.enum(
    ['PRACTICE OWNER', 'PRACTICE MANAGER', 'COMPANY DIRECTOR', 'PRACTICE USER'],
    {
      message: 'Please select a role'
    }
  )
})

interface InviteUserDialogProps {
  open: boolean
  onClose: () => void
  onInvite: (data: InviteUserFormData) => Promise<void>
  loading?: boolean
  error?: string | null
}

const InviteUserDialog: React.FC<InviteUserDialogProps> = React.memo(
  ({ open, onClose, onInvite, loading = false }) => {
    const {
      control,
      handleSubmit,
      reset,
      watch,
      formState: { errors }
    } = useForm<InviteUserFormData>({
      resolver: zodResolver(inviteUserSchema),
      defaultValues: {
        email: '',
        role: 'PRACTICE USER' as UserRole
      },
      mode: 'onChange'
    })

    const email = watch('email')

    const handleClose = useCallback(() => {
      reset()
      onClose()
    }, [reset, onClose])

    const onSubmit: SubmitHandler<InviteUserFormData> = useCallback(
      async (data) => {
        try {
          await onInvite(data)
          reset()
          onClose()
        } catch {
          // Error handling is managed by parent component
        }
      },
      [onInvite, reset, onClose]
    )

    return (
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth='sm'
        fullWidth
        slotProps={{
          paper: {
            sx: {
              py: '36px',
              px: { xs: 2, sm: 6 }
            }
          }
        }}
      >
        <DialogTitle sx={{ p: 0, mb: '12px' }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1
            }}
          >
            <img
              src='/assets/user-tick.svg'
              alt='user invitation icon'
              style={{ width: 48, height: 48 }}
            />
            <Typography
              className='font-weight--700'
              sx={{
                typography: { xs: 'h6', sm: 'h5' }
              }}
            >
              Invite new team member
            </Typography>
            <Typography variant='subtitle1' color='text.secondary'>
              Send an invitation to join your practice team
            </Typography>
          </Box>
        </DialogTitle>

        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent sx={{ p: 0, pt: 1, gap: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Controller
                name='email'
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label='Email Address'
                    type='text'
                    fullWidth
                    size='medium'
                    error={!!errors.email}
                    helperText={errors.email?.message}
                    disabled={loading}
                    required
                  />
                )}
              />

              <Controller
                name='role'
                control={control}
                render={({ field }) => (
                  <FormControl
                    fullWidth
                    error={!!errors.role}
                    disabled={loading}
                    size='medium'
                    required
                  >
                    <InputLabel>Role</InputLabel>
                    <Select {...field} label='Role'>
                      {USER_ROLES.map((role) => (
                        <MenuItem key={role.value} value={role.value}>
                          {role.label}
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.role && (
                      <Typography
                        variant='caption'
                        color='error'
                        sx={{ mt: 0.5, ml: 1.5 }}
                      >
                        {errors.role.message}
                      </Typography>
                    )}
                  </FormControl>
                )}
              />
            </Box>
          </DialogContent>

          <DialogActions sx={{ p: 0, mt: '20px' }}>
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
                disabled={loading || !email || !!errors.email}
                fullWidth
                size='large'
                startIcon={loading ? <CircularProgress size={16} /> : null}
                sx={{
                  bgcolor: 'black',
                  '&:hover': {
                    bgcolor: 'rgba(0, 0, 0, 0.8)'
                  }
                }}
              >
                {loading ? 'Sending...' : 'Send Invitation'}
              </Button>
            </Box>
          </DialogActions>
        </form>
      </Dialog>
    )
  }
)

InviteUserDialog.displayName = 'InviteUserDialog'

export default InviteUserDialog
