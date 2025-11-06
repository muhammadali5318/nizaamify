import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Alert
} from '@mui/material'
import { useForm, Controller, SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { USER_ROLES } from 'src/const'
import { UserRole } from 'src/components/team-management/common/team-management'
import { useAuth } from 'src/context/AuthProvider'
import { useInitialData } from 'src/hooks/useFetchInitialData'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import { queryClient } from 'src/utils/queryClient'
import { notify } from 'src/components/notistack/NotificationProvider'
import { useActivePractice } from 'src/hooks/useActivePractice'
import {
  SelectedUserType,
  setSelectedUser
} from 'src/store/slices/team-management/selectedUserSlice'
import { useDispatch } from 'react-redux'

const userRoleValues = USER_ROLES.map((role) => role.value) as [
  string,
  ...string[]
]

const updateMemberRoleSchema = z.object({
  role: z.enum(userRoleValues, {
    message: 'Please select a role'
  })
})

type FormDataValues = z.infer<typeof updateMemberRoleSchema>

interface UpdateMemberRoleModalProps {
  open: boolean
  onClose: () => void
  member: SelectedUserType
}

const UpdateMemberRoleModal: React.FC<UpdateMemberRoleModalProps> = React.memo(
  ({ open, onClose, member }) => {
    const { accessToken } = useAuth()
    const { activePracticeId } = useActivePractice()
    const { data: practiceData } = useInitialData(!!accessToken)
    const dispatch = useDispatch()

    const [loading, setLoading] = useState(false)

    const {
      control,
      handleSubmit,
      reset,
      formState: { errors },
      watch
    } = useForm<FormDataValues>({
      resolver: zodResolver(updateMemberRoleSchema),
      defaultValues: {
        role: member?.user_role || ('PRACTICE USER' as UserRole)
      },
      mode: 'onChange'
    })

    useEffect(() => {
      if (member) {
        reset({
          role: member.user_role || ('PRACTICE USER' as UserRole)
        })
      }
    }, [member, reset, open])

    const handleClose = useCallback(() => {
      reset()
      onClose()
    }, [reset, onClose])

    const onSubmit: SubmitHandler<FormDataValues> = useCallback(
      async (data) => {
        setLoading(true)
        try {
          await apiClient.put(
            endpoints.updateMemberRole(activePracticeId ?? '', member?.user_id),
            {
              user_role: data?.role
            }
          )
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['teamMembersListApi'] }),
            queryClient.invalidateQueries({
              queryKey: [
                'membersRolesAndPermissions',
                activePracticeId,
                member?.user_id
              ]
            })
          ])

          reset()
          onClose()
          notify.success('Role changed successfully')
          dispatch(setSelectedUser({ ...member, user_role: data?.role }))
        } catch (error: any) {
          console.error(error)
          notify.error(
            error?.message ||
              error?.error?.user_role[0] ||
              'Something went wrong, Please try again.'
          )
        } finally {
          setLoading(false)
        }
      },
      [reset, onClose, activePracticeId, member?.user_id]
    )

    const selectedRole = watch('role')
    const isRoleChanged = useMemo(
      () => selectedRole !== member?.user_role,
      [selectedRole, member?.user_role]
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
              px: { xs: 2, sm: 6 },
              borderRadius: '24px'
            }
          }
        }}
      >
        <DialogTitle sx={{ p: 0, mb: '12px' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
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
              Change user role
            </Typography>
            <Box>
              <Typography variant='subtitle1' color='text.primary'>
                You’re about to update the role for{' '}
                <strong>{member?.user_name || 'this user'}</strong> in{' '}
                <strong>{practiceData?.practice_name}</strong>.
              </Typography>
              <Typography variant='subtitle1' color='text.primary'>
                Select a new role from the list below.
              </Typography>
            </Box>
          </Box>
        </DialogTitle>

        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent sx={{ p: 0, pt: 1, gap: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Controller
                name='role'
                control={control}
                render={({ field }) => (
                  <FormControl
                    fullWidth
                    error={!!errors.role}
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

              <Alert severity='info' className='alert-info-container'>
                <Typography
                  className='alert-info-text font-weight--500'
                  component='div'
                  sx={{ margin: 0 }}
                >
                  Changing a user’s role will immediately update their
                  permissions across Monai.
                </Typography>
              </Alert>
            </Box>
          </DialogContent>

          <DialogActions sx={{ p: 0, mt: '20px' }}>
            <Box sx={{ display: 'flex', gap: 2, width: '100%' }}>
              <Button
                variant='outlined'
                onClick={handleClose}
                fullWidth
                size='large'
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type='submit'
                variant='contained'
                fullWidth
                size='large'
                disabled={!isRoleChanged || loading}
                loading={loading}
                sx={{
                  bgcolor: 'black',
                  '&:hover': {
                    bgcolor: 'rgba(0, 0, 0, 0.8)'
                  }
                }}
              >
                Update role
              </Button>
            </Box>
          </DialogActions>
        </form>
      </Dialog>
    )
  }
)

UpdateMemberRoleModal.displayName = 'UpdateMemberRoleModal'

export default UpdateMemberRoleModal
