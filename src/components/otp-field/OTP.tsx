import { Box, TextField } from '@mui/material'
import React, { useRef } from 'react'

type OTPProps = {
  length?: number
  value: string
  onChange: (val: string) => void
}

const OTP: React.FC<OTPProps> = ({ length = 6, value, onChange }) => {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([])

  const focusInput = (index: number) => {
    inputRefs.current[index]?.focus()
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number
  ) => {
    const val = e.target.value

    if (!/^\d*$/.test(val)) return

    const newOtp = value.split('')
    newOtp[index] = val.slice(-1)

    onChange(newOtp.join(''))

    if (val && index < length - 1) {
      focusInput(index + 1)
    }
  }

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number
  ) => {
    if (e.key === 'Backspace') {
      const newOtp = value.split('')
      newOtp[index] = ''
      onChange(newOtp.join(''))

      if (index > 0) {
        focusInput(index - 1)
      }
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const paste = e.clipboardData.getData('text').slice(0, length)

    if (!/^\d+$/.test(paste)) return

    onChange(paste)
    focusInput(paste.length - 1)
  }

  return (
    <Box display='flex' gap={1}>
      {Array.from({ length }).map((_, index) => (
        <TextField
          key={index}
          value={value[index] || ''}
          inputRef={(el) => (inputRefs.current[index] = el)}
          onChange={(e) => handleChange(e, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          onPaste={handlePaste}
          inputProps={{
            maxLength: 1,
            style: {
              textAlign: 'center',
              fontSize: '18px',
              padding: '12px'
            }
          }}
          sx={{
            width: 70,
            height: 70,
            '& .MuiOutlinedInput-root': {
              height: '100%',
              borderRadius: '12px'
            },
            '& input': {
              textAlign: 'center',
              fontSize: '20px',
              fontWeight: 600,
              padding: 0
            }
          }}
        />
      ))}
    </Box>
  )
}

export default OTP
