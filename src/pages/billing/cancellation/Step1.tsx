import { Box, Typography, TextField, Button } from '@mui/material'
import { useState } from 'react'

import useUserDetails from 'src/hooks/useUserDetails'

export const Step1 = ({ goNext, close }: any) => {
  const [activeEmail, setActiveEmail] = useState('')
  const [error, setError] = useState('')
  const { email } = useUserDetails()
  const currentUserEmail = email

  const handleChange = (value: string) => {
    setActiveEmail(value)

    // Validation
    if (!value.trim()) {
      setError('Email is required')
    } else if (value.trim() !== currentUserEmail) {
      setError('Email does not match your registered email')
    } else {
      setError('')
    }
  }

  return (
    <Box>
      <Typography variant='h6'>Verify Your Identity</Typography>

      <Typography variant='body2' sx={{ mb: 1 }}>
        To proceed with your cancellation request, please confirm your
        registered email address.
      </Typography>

      <Typography variant='body2' sx={{ mb: 2 }}>
        This verification ensures the security of your account.
      </Typography>

      <TextField
        required
        fullWidth
        label='Email address'
        value={activeEmail}
        error={!!error}
        helperText={error}
        onChange={(e) => handleChange(e.target.value)}
      />

      <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
        <Button variant='outlined' onClick={close} fullWidth size='small'>
          Back
        </Button>

        <Button
          variant='contained'
          sx={{ borderRadius: '12px' }}
          fullWidth
          disabled={!!error || !activeEmail.trim()}
          onClick={() => goNext({ activeEmail })}
        >
          Verify & continue
        </Button>
      </Box>
    </Box>
  )
}
