import { Box, Button, Stack, Typography, TextField } from '@mui/material'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth0 } from '@auth0/auth0-react'

export interface VerifyIdentityStepProps {
  onNext: () => void
  onCancel?: () => void
}

export function VerifyIdentityStep({
  onNext,
  onCancel
}: VerifyIdentityStepProps) {
  const { user } = useAuth0()
  const referenceEmail = user?.email ?? ''

  const schema = z.object({
    email: z
      .string()
      .refine((val) => /^\S+@\S+\.\S+$/.test(val), {
        message: 'Enter a valid email'
      })
      .refine((val) => val === referenceEmail, {
        message: 'Please enter the correct email'
      })
  })
  const {
    handleSubmit,
    control,
    formState: { isValid }
  } = useForm({
    resolver: zodResolver(schema),
    mode: 'onChange'
  })

  const onSubmit = () => {
    onNext()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Stack spacing={1.8}>
        <Stack spacing={'2px'}>
          <Typography variant='h5' color='#000' fontWeight={700}>
            Verify Your Identity
          </Typography>
          <Box>
            <Typography variant='subtitle1' color='text.primary'>
              To proceed with archiving this practice, please confirm your
              registered email address.
            </Typography>
            <Typography variant='subtitle1' color='text.primary'>
              This helps us ensure that only authorized users can make this
              change.
            </Typography>
          </Box>
        </Stack>

        <Controller
          name='email'
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              {...field}
              label='Email Address'
              fullWidth
              required
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
            />
          )}
        />

        <Box
          display={'flex'}
          gap={1.2}
          flexDirection={{ xs: 'column', sm: 'row' }}
        >
          <Button fullWidth variant='outlined' onClick={onCancel}>
            Cancel
          </Button>

          <Button
            fullWidth
            variant='contained'
            type='submit'
            disabled={!isValid}
          >
            Verify & Continue
          </Button>
        </Box>
      </Stack>
    </form>
  )
}
