import { Visibility, VisibilityOff } from '@mui/icons-material'
import { TextField, InputAdornment, IconButton } from '@mui/material'
import { useState } from 'react'
import { Controller } from 'react-hook-form'

const PasswordField: React.FC<{
  name: 'password' | 'confirmPassword'
  label: string
  control: any
  helperText?: string
}> = ({ name, label, control, helperText }) => {
  const [visible, setVisible] = useState(false)

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <TextField
          {...field}
          fullWidth
          label={label}
          type={visible ? 'text' : 'password'}
          error={!!fieldState.error}
          helperText={
            fieldState.error?.message ? fieldState.error?.message : helperText
          }
          slotProps={{
            inputLabel: {
              shrink: true
            },
            input: {
              autoComplete: 'off',
              endAdornment: (
                <InputAdornment position='end'>
                  <IconButton
                    aria-label={visible ? 'Hide password' : 'Show password'}
                    onClick={() => setVisible((s) => !s)}
                    edge='end'
                  >
                    {visible ? <Visibility /> : <VisibilityOff />}
                  </IconButton>
                </InputAdornment>
              )
            }
          }}
        />
      )}
    />
  )
}

export default PasswordField
