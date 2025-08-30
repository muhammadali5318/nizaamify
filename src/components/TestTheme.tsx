// src/components/TestTheme.tsx
import { useState } from 'react'
import {
  Box,
  Button,
  Typography,
  Stack,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Checkbox,
  Radio,
  RadioGroup,
  FormControlLabel,
  Switch
} from '@mui/material'
import './TestTheme.scss'

const colors: Array<
  'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' | 'inherit'
> = ['primary', 'secondary', 'error', 'warning', 'info', 'success', 'inherit']

const variants: Array<'contained' | 'outlined' | 'text'> = [
  'contained',
  'outlined',
  'text'
]

function AllMuiButtons() {
  return (
    <Stack spacing={2}>
      {variants.map((variant) => (
        <Box key={variant} sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {colors.map((color) => (
            <Button key={color} variant={variant} color={color}>
              {variant} {color}
            </Button>
          ))}
        </Box>
      ))}
    </Stack>
  )
}

export default function TestTheme() {
  const [selectValue, setSelectValue] = useState('')
  const [radioValue, setRadioValue] = useState('option1')

  return (
    <Box sx={{ p: 3 }}>
      {/* TYPOGRAPHY */}
      <Typography variant='h4' gutterBottom>
        Typography Showcase
      </Typography>
      <Typography variant='h1'>h1 The quick brown fox</Typography>
      <Typography variant='h2'>h2 The quick brown fox</Typography>
      <Typography variant='h3'>h3 The quick brown fox</Typography>
      <Typography variant='h4'>h4 The quick brown fox</Typography>
      <Typography variant='h5'>h5 The quick brown fox</Typography>
      <Typography variant='h6'>h6 The quick brown fox</Typography>
      <Typography variant='subtitle1'>subtitle1 The quick brown fox</Typography>
      <Typography variant='subtitle2'>subtitle2 The quick brown fox</Typography>
      <Typography variant='body1'>body1 The quick brown fox</Typography>
      <Typography variant='body2'>body2 The quick brown fox</Typography>
      <Typography variant='caption'>caption The quick brown fox</Typography>
      <Typography variant='overline'>overline The quick brown fox</Typography>

      {/* BUTTONS */}
      <Typography variant='h4' mt={4} gutterBottom>
        Buttons
      </Typography>
      <AllMuiButtons />

      {/* TEXTFIELDS */}
      <Typography variant='h4' mt={4} gutterBottom>
        TextFields
      </Typography>
      <Stack spacing={2} direction='row'>
        <TextField label='Outlined' variant='outlined' />
        <TextField label='Filled' variant='filled' />
        <TextField label='Standard' variant='standard' />
      </Stack>

      {/* SELECT / DROPDOWN */}
      <Typography variant='h4' mt={4} gutterBottom>
        Select / Dropdown
      </Typography>
      <FormControl sx={{ minWidth: 200 }}>
        <InputLabel id='demo-select-label'>Choose Option</InputLabel>
        <Select
          labelId='demo-select-label'
          value={selectValue}
          label='Choose Option'
          onChange={(e) => setSelectValue(e.target.value)}
        >
          <MenuItem value='option1'>Option 1</MenuItem>
          <MenuItem value='option2'>Option 2</MenuItem>
          <MenuItem value='option3'>Option 3</MenuItem>
        </Select>
      </FormControl>

      {/* CHECKBOX / RADIO / SWITCH */}
      <Typography variant='h4' mt={4} gutterBottom>
        Inputs
      </Typography>
      <Stack direction='row' spacing={4}>
        <FormControlLabel control={<Checkbox />} label='Checkbox' />
        <RadioGroup
          row
          value={radioValue}
          onChange={(e) => setRadioValue(e.target.value)}
        >
          <FormControlLabel value='option1' control={<Radio />} label='Option 1' />
          <FormControlLabel value='option2' control={<Radio />} label='Option 2' />
        </RadioGroup>
        <FormControlLabel control={<Switch />} label='Switch' />
      </Stack>
    </Box>
  )
}
  