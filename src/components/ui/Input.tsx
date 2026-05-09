import { forwardRef } from 'react'
import TextField, { type TextFieldProps } from '@mui/material/TextField'

export type InputSize = 'md' | 'lg'

export interface InputProps extends Omit<TextFieldProps, 'size' | 'variant'> {
  inputSize?: InputSize
}

const SIZE_PX: Record<InputSize, number> = { md: 40, lg: 44 }

/**
 * Standard text input. Outlined MUI TextField with token-driven height
 * (md=40px desktop, lg=44px touch-friendly). Use inside <Field> for label
 * + hint + error wiring.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { inputSize = 'md', sx, slotProps, ...rest },
  ref
) {
  const minHeight = SIZE_PX[inputSize]
  return (
    <TextField
      inputRef={ref}
      variant='outlined'
      fullWidth
      slotProps={{
        ...slotProps,
        input: {
          ...(slotProps?.input ?? {}),
          sx: {
            minHeight,
            ...((slotProps?.input as { sx?: object } | undefined)?.sx ?? {})
          }
        }
      }}
      sx={[
        { '& .MuiOutlinedInput-root': { minHeight } },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : [])
      ]}
      {...rest}
    />
  )
})

export default Input
