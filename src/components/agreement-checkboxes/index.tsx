import React from 'react'
import { Stack, Checkbox, Typography, FormHelperText } from '@mui/material'
import { Controller, Control, Path, FieldValues } from 'react-hook-form'

type AgreementKeys = 'terms' | 'privacy' | 'disclaimer' | 'gdpr'

type AgreementsCheckboxesProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>
  names?: Record<AgreementKeys, Path<TFieldValues>>
  namePrefix?: string
  spacing?: number
  /** When true, individual per-checkbox errors are not shown.
   * Useful when you want a single global error message instead. */
  hideIndividualErrors?: boolean
}

const LABELS: Record<AgreementKeys, React.ReactNode> = {
  terms: (
    <>
      I agree to the{' '}
      <span className='info-main font-weight--700 cursor-pointer'>
        Terms of Service
      </span>
    </>
  ),
  privacy: (
    <>
      I agree to the{' '}
      <span className='info-main font-weight--700 cursor-pointer'>
        Privacy Policy
      </span>
    </>
  ),
  disclaimer: (
    <>
      I acknowledge the{' '}
      <span className='info-main font-weight--700 cursor-pointer'>
        Financial Disclaimer
      </span>
    </>
  ),
  gdpr: (
    <>
      I consent to data usage under{' '}
      <span className='info-main font-weight--700 cursor-pointer'>GDPR</span>
    </>
  )
}

function AgreementsCheckboxes<TFieldValues extends FieldValues>({
  control,
  names,
  namePrefix = '',
  spacing = 0,
  hideIndividualErrors = false
}: AgreementsCheckboxesProps<TFieldValues>) {
  const pathFor = (key: AgreementKeys): Path<TFieldValues> => {
    if (names && names[key]) return names[key]
    const built = namePrefix ? `${namePrefix}.${key}` : key
    return built as unknown as Path<TFieldValues>
  }

  const renderCtrl = (key: AgreementKeys) => (
    <Controller
      key={key}
      name={pathFor(key)}
      control={control}
      render={({ field, fieldState }) => (
        <>
          <Stack direction='row' alignItems='center'>
            <Checkbox
              checked={!!field.value}
              onChange={(e) => field.onChange(e.target.checked)}
              onBlur={field.onBlur}
              name={field.name}
              slotProps={{ input: { ref: field.ref } }}
            />
            <Typography variant='body1'>{LABELS[key]}</Typography>
          </Stack>
          {!hideIndividualErrors && fieldState.error && (
            <FormHelperText error>
              {(fieldState.error as any)?.message}
            </FormHelperText>
          )}
        </>
      )}
    />
  )

  return (
    <Stack spacing={spacing}>
      {renderCtrl('terms')}
      {renderCtrl('privacy')}
      {renderCtrl('disclaimer')}
      {renderCtrl('gdpr')}
    </Stack>
  )
}

export default AgreementsCheckboxes
