import React from 'react'
import { Stack, Checkbox, Typography, FormHelperText } from '@mui/material'
import { Controller, Control, Path, FieldValues } from 'react-hook-form'

type AgreementKeys =
  | 'terms'
  | 'privacy'
  | 'disclaimer'
  | 'dataProcessingAgreement'
  | 'cookiePolicy'

type AgreementsCheckboxesProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>
  names?: Record<AgreementKeys, Path<TFieldValues>>
  namePrefix?: string
  spacing?: number
  hideIndividualErrors?: boolean
}

const LABELS: Record<AgreementKeys, React.ReactNode> = {
  terms: (
    <>
      I agree to the{' '}
      <a
        href='/auth/signup/agreements'
        target='_blank'
        rel='noopener noreferrer'
        className='info-main font-weight--700 cursor-pointer'
        style={{ textDecoration: 'none' }}
      >
        Terms of Service
      </a>
    </>
  ),
  privacy: (
    <>
      I agree to the{' '}
      <a
        href='/auth/signup/agreements'
        target='_blank'
        rel='noopener noreferrer'
        className='info-main font-weight--700 cursor-pointer'
        style={{ textDecoration: 'none' }}
      >
        Privacy Policy
      </a>
    </>
  ),
  disclaimer: (
    <>
      I acknowledge the{' '}
      <a
        href='/auth/signup/agreements'
        target='_blank'
        rel='noopener noreferrer'
        className='info-main font-weight--700 cursor-pointer'
        style={{ textDecoration: 'none' }}
      >
        Financial Disclaimer
      </a>
    </>
  ),
  dataProcessingAgreement: (
    <>
      I consent to data usage under{' '}
      <a
        href='/auth/signup/agreements'
        target='_blank'
        rel='noopener noreferrer'
        className='info-main font-weight--700 cursor-pointer'
        style={{ textDecoration: 'none' }}
      >
        Data Processing Agreement
      </a>
    </>
  ),
  cookiePolicy: (
    <>
      I agree to the{' '}
      <a
        href='/auth/signup/agreements'
        target='_blank'
        rel='noopener noreferrer'
        className='info-main font-weight--700 cursor-pointer'
        style={{ textDecoration: 'none' }}
      >
        Cookie Policy
      </a>
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
      {renderCtrl('dataProcessingAgreement')}
      {renderCtrl('cookiePolicy')}
    </Stack>
  )
}

export default AgreementsCheckboxes
