import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type ReactElement,
  type ReactNode
} from 'react'
import Box from '@mui/material/Box'
import FormHelperText from '@mui/material/FormHelperText'
import Typography from '@mui/material/Typography'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'

export interface FieldProps {
  /** Visible label. Pass `''` only for visually-hidden cases (rare). */
  label: ReactNode
  /** Hint shown when there is no error. */
  hint?: ReactNode
  /** Validation error text. When non-empty, replaces the hint and turns the field red. */
  error?: string
  /** Marks the field as required and shows an asterisk after the label. */
  required?: boolean
  /** Optional explicit id for the input. Auto-generated otherwise so aria wiring works. */
  htmlFor?: string
  /** Single input element (Input, Textarea, MUI TextField, Select, etc.). */
  children: ReactElement<{
    id?: string
    'aria-describedby'?: string
    'aria-invalid'?: boolean
    error?: boolean
  }>
}

/**
 * Universal form atom (spec §8). Wraps any input element with a visible label,
 * optional hint text, and an error slot that replaces the hint when populated.
 * Wires aria-describedby and aria-invalid on the child input automatically.
 */
export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children
}: FieldProps) {
  const reactId = useId()
  const child = Children.only(children)
  const inputId = htmlFor ?? child.props.id ?? `field-${reactId}`
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`
  const describedBy = error ? errorId : hint ? hintId : undefined
  const hasError = Boolean(error)

  const enhancedChild = isValidElement(child)
    ? cloneElement(child, {
        id: inputId,
        'aria-describedby': describedBy,
        'aria-invalid': hasError || undefined,
        // MUI inputs accept an `error` boolean — pass it through.
        error: hasError || undefined
      })
    : child

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {label !== '' && (
        <Typography
          component='label'
          htmlFor={inputId}
          variant='caption'
          sx={{
            color: 'var(--text-secondary)',
            fontWeight: 500,
            // logical-property friendly
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5
          }}
        >
          {label}
          {required && (
            <Box
              component='span'
              aria-hidden='true'
              sx={{ color: 'var(--error-500)', marginInlineStart: 0.25 }}
            >
              *
            </Box>
          )}
        </Typography>
      )}
      {enhancedChild}
      {error ? (
        <FormHelperText
          id={errorId}
          role='alert'
          error
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            margin: 0,
            color: 'var(--error-700)'
          }}
        >
          <ErrorOutlineIcon sx={{ fontSize: 14 }} />
          {error}
        </FormHelperText>
      ) : hint ? (
        <FormHelperText
          id={hintId}
          sx={{ margin: 0, color: 'var(--text-muted)' }}
        >
          {hint}
        </FormHelperText>
      ) : null}
    </Box>
  )
}

export default Field
