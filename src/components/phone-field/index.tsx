// ------------------------------
// FILE: src/components/form-fields/PhoneField.tsx
import React from 'react'
import { Controller, Control, FieldValues } from 'react-hook-form'
import { MuiTelInput } from 'mui-tel-input'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { ArrowDropDown } from '@mui/icons-material'
import { Box, FormControl, FormHelperText } from '@mui/material'

type PhoneFieldProps<T extends FieldValues> = {
  control: Control<T>
  name: keyof T
  label?: string
}

function PhoneField<T extends FieldValues>({
  control,
  name,
  label = 'Phone Number'
}: PhoneFieldProps<T>) {
  const phoneWrapperRef = React.useRef<HTMLDivElement | null>(null)

  const openCountryDropdown = () => {
    const root = phoneWrapperRef.current as HTMLElement | null
    if (!root) return
    const flagEl = root.querySelector<HTMLElement>('.MuiTelInput-Flag')
    if (flagEl) flagEl.click()
  }

  const handleArrowKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openCountryDropdown()
    }
  }

  return (
    <Controller
      name={name as string}
      control={control}
      rules={{
        validate: (v: string) => {
          if (!v) return 'Phone required'
          const phone = parsePhoneNumberFromString(v)
          return phone && phone.isValid()
            ? true
            : 'Please enter a valid phone number'
        }
      }}
      render={({ field, fieldState }) => (
        <FormControl fullWidth error={!!fieldState.error}>
          <Box sx={{ position: 'relative' }} ref={phoneWrapperRef}>
            <MuiTelInput
              {...field}
              fullWidth
              required
              label={label}
              variant='outlined'
              defaultCountry='GB'
              onlyCountries={['GB']}
              placeholder='Enter phone number'
              onChange={(val) => field.onChange(val ?? '')}
              sx={{
                '& .MuiTelInput-Flag': {
                  borderRadius: '50%',
                  width: 24,
                  height: 24,
                  overflow: 'hidden',
                  boxShadow: '0 0 0 2px rgba(0,0,0,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                },
                '& .MuiTelInput-Flag img': {
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: '50%'
                },
                '& .MuiInputBase-input': {
                  // Logical: gives space for the country flag chip, which
                  // sits at the start (left in LTR, right in RTL) edge.
                  paddingInlineStart: '24px'
                }
              }}
            />

            <ArrowDropDown
              onClick={openCountryDropdown}
              onKeyDown={handleArrowKey}
              role='button'
              tabIndex={0}
              aria-label='Open country list'
              sx={{
                position: 'absolute',
                left: 54,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 28,
                color: 'text.secondary',
                cursor: 'pointer',
                pointerEvents: 'auto'
              }}
            />
          </Box>

          <FormHelperText>{fieldState.error?.message}</FormHelperText>
        </FormControl>
      )}
    />
  )
}

export default PhoneField
