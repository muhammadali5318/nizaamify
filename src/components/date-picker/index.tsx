import React, { useState } from 'react'
import { Controller, Control } from 'react-hook-form'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import type { Dayjs } from 'dayjs'
import { InputAdornment, IconButton, TextFieldProps } from '@mui/material'
import InsertInvitationIcon from '@mui/icons-material/InsertInvitation'

interface ReusableDatePickerProps {
  name: string
  control: Control<any>
  label?: string
  disabled?: boolean
  required?: boolean
  minDate?: Dayjs | undefined
  maxDate?: Dayjs | undefined
  disableFuture?: boolean
  textFieldProps?: Partial<TextFieldProps>
  onChange?: (val: Dayjs | null) => void
}

const ReusableDatePicker: React.FC<ReusableDatePickerProps> = ({
  name,
  control,
  label = 'Select date',
  disabled = false,
  required = false,
  minDate,
  maxDate,
  disableFuture = false,
  textFieldProps,
  onChange
}) => {
  const [pickerOpen, setPickerOpen] = useState(false)

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale='en-gb'>
      <Controller
        name={name}
        control={control}
        render={({ field, fieldState }) => {
          const value = field.value ?? null

          return (
            <DatePicker
              value={value}
              format='DD/MM/YYYY'
              disableFuture={disableFuture}
              minDate={minDate ?? undefined}
              maxDate={maxDate ?? undefined}
              open={pickerOpen}
              onOpen={() => setPickerOpen(true)}
              onClose={() => setPickerOpen(false)}
              onChange={(val) => {
                field.onChange(val)
                onChange?.(val ?? null)
              }}
              disabled={disabled}
              label={label + (required ? ' *' : '')}
              slotProps={{
                textField: {
                  fullWidth: true,
                  variant: 'outlined',
                  ...textFieldProps,
                  error: !!fieldState.error,
                  helperText:
                    fieldState.error?.message ?? textFieldProps?.helperText,
                  InputLabelProps: { shrink: true },
                  InputProps: {
                    ...textFieldProps?.InputProps,
                    endAdornment: (
                      <InputAdornment position='end'>
                        <IconButton
                          onClick={() => setPickerOpen((s) => !s)}
                          edge='end'
                          size='small'
                          aria-label='open calendar'
                        >
                          <InsertInvitationIcon />
                        </IconButton>
                      </InputAdornment>
                    )
                  },
                  sx: {
                    '& .MuiPickersInputBase-root, & .MuiPickersOutlinedInput-root':
                      {
                        borderRadius: '12px',
                        overflow: 'hidden',
                        '& fieldset': { borderRadius: '12px' }
                      },
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderRadius: '12px'
                    },
                    '&& .MuiPickersInputBase-root, && .MuiPickersOutlinedInput-root, && .MuiOutlinedInput-notchedOutline':
                      { borderRadius: '12px' },
                    ...(textFieldProps?.sx as object)
                  }
                },
                popper: {
                  disablePortal: true,
                  sx: { zIndex: (t: any) => t.zIndex.modal + 10 }
                }
              }}
            />
          )
        }}
      />
    </LocalizationProvider>
  )
}

export default ReusableDatePicker
