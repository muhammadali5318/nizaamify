import { forwardRef } from 'react'
import TextField, { type TextFieldProps } from '@mui/material/TextField'

export interface TextareaProps extends Omit<
  TextFieldProps,
  'multiline' | 'variant'
> {
  /** Max rows before scrolling appears (default 8 per spec §6). */
  maxRows?: number
  /** Min rows shown collapsed (default 3). */
  minRows?: number
}

/** Multiline text input. Auto-resizes between minRows and maxRows. */
export const Textarea = forwardRef<HTMLInputElement, TextareaProps>(
  function Textarea({ maxRows = 8, minRows = 3, ...rest }, ref) {
    return (
      <TextField
        inputRef={ref}
        variant='outlined'
        fullWidth
        multiline
        minRows={minRows}
        maxRows={maxRows}
        {...rest}
      />
    )
  }
)

export default Textarea
