import { useEffect, useState } from 'react'
import { Box, IconButton, TextField } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'

type Props = {
  value: number
  min?: number
  max?: number
  onChange: (next: number) => void
  onAtMaxAttempt?: () => void
  ariaLabel?: string
}

const BTN_SX = {
  width: 40,
  height: 40,
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: '50%'
}

export default function QtyStepper({
  value,
  min = 1,
  max,
  onChange,
  onAtMaxAttempt,
  ariaLabel
}: Props) {
  // Local string state lets the user type freely; we snap on blur.
  const [draft, setDraft] = useState(String(value))

  useEffect(() => {
    setDraft(String(value))
  }, [value])

  const dec = () => {
    if (value > min) onChange(value - 1)
  }
  const inc = () => {
    if (max !== undefined && value >= max) {
      onAtMaxAttempt?.()
      return
    }
    onChange(value + 1)
  }

  const commitDraft = () => {
    const parsed = parseInt(draft, 10)
    if (!Number.isFinite(parsed)) {
      setDraft(String(value))
      return
    }
    let next = Math.trunc(parsed)
    if (next < min) next = min
    if (max !== undefined && next > max) next = max
    if (next !== value) onChange(next)
    setDraft(String(next))
  }

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75
      }}
      aria-label={ariaLabel}
    >
      <IconButton
        size='small'
        onClick={dec}
        disabled={value <= min}
        sx={BTN_SX}
        aria-label='decrease quantity'
      >
        <RemoveIcon fontSize='small' />
      </IconButton>
      <TextField
        size='small'
        value={draft}
        onChange={(e) => {
          // Allow only digits while typing
          const v = e.target.value.replace(/[^\d]/g, '')
          setDraft(v)
        }}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            ;(e.target as HTMLInputElement).blur()
          } else if (e.key === 'Escape') {
            setDraft(String(value))
            ;(e.target as HTMLInputElement).blur()
          }
        }}
        inputProps={{
          inputMode: 'numeric',
          pattern: '[0-9]*',
          'aria-label': ariaLabel,
          style: { textAlign: 'center', width: 44, padding: '8px 4px' }
        }}
        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
      />
      <IconButton
        size='small'
        onClick={inc}
        disabled={max !== undefined && value >= max}
        sx={BTN_SX}
        aria-label='increase quantity'
      >
        <AddIcon fontSize='small' />
      </IconButton>
    </Box>
  )
}
