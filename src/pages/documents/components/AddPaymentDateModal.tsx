import React, { useCallback } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress
} from '@mui/material'
import { useForm, SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import ReusableDatePicker from 'src/components/date-picker'

const addPaymentSchema = z.object({
  date: z.any().refine(
    (val) => {
      if (!val) return false
      if (typeof val?.isValid === 'function') return val.isValid()
      return val instanceof Date && !isNaN(val.getTime())
    },
    { message: 'Please select a valid date' }
  )
})

type AddPaymentFormData = z.infer<typeof addPaymentSchema>

interface InviteUserDialogProps {
  open: boolean
  onClose: () => void
  onInvite: (data: AddPaymentFormData) => Promise<void> | void
  loading?: boolean
}

const AddPaymentDateModal: React.FC<InviteUserDialogProps> = React.memo(
  ({ open, onClose, onInvite, loading = false }) => {
    const {
      control,
      handleSubmit,
      reset,
      watch,
      formState: { errors }
    } = useForm<AddPaymentFormData>({
      resolver: zodResolver(addPaymentSchema),
      defaultValues: { date: null },
      mode: 'onChange'
    })

    const selectedDate = watch('date')

    const handleClose = useCallback(() => {
      reset()
      onClose()
    }, [reset, onClose])

    const onSubmit: SubmitHandler<AddPaymentFormData> = useCallback(
      async (data) => {
        try {
          await onInvite(data)
          reset()
          onClose()
        } catch {
          // parent handles errors
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
              px: { xs: 2, sm: 6 },
              borderRadius: '24px',
              overflow: 'visible'
            }
          }
        }}
      >
        <DialogTitle sx={{ p: 0, mb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <img
              src='/assets/doc-green.svg'
              alt='user invitation icon'
              style={{ width: 64, height: 64 }}
            />
            <Typography
              className='font-weight--700'
              sx={{ typography: { xs: 'h6', sm: 'h5' } }}
            >
              Payment date required
            </Typography>
            <Typography variant='subtitle1' color='text.primary'>
              This document is missing a payment date. Please provide the
              payment date to complete the record. Once added, the document will
              be processed and reflected in your financial KPIs.
            </Typography>
          </Box>
        </DialogTitle>

        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent sx={{ p: 0, pt: 1, gap: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <ReusableDatePicker
                name='date'
                control={control}
                label='Payment date:'
                disabled={loading}
                textFieldProps={{
                  variant: 'outlined'
                }}
              />
            </Box>
          </DialogContent>

          <DialogActions sx={{ p: 0, mt: 3 }}>
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
                disabled={loading || !selectedDate || !!errors.date}
                fullWidth
                size='large'
                startIcon={loading ? <CircularProgress size={16} /> : null}
                sx={{
                  bgcolor: 'black',
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' }
                }}
              >
                {loading ? 'Saving...' : 'Save & process document'}
              </Button>
            </Box>
          </DialogActions>
        </form>
      </Dialog>
    )
  }
)

AddPaymentDateModal.displayName = 'AddPaymentDateModal'

export default AddPaymentDateModal
