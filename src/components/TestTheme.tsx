// src/components/TestTheme.jsx
import { useState } from 'react'
import { Box, Button, Typography, Card, CardContent } from '@mui/material'
import './TestTheme.scss'

export default function TestTheme() {
  const [dark, setDark] = useState(false)

  const toggleTheme = () => {
    document.documentElement.setAttribute('data-theme', dark ? 'light' : 'dark')
    setDark(!dark)
  }

  const changePrimary = () => {
    // Example: change color at runtime
    document.documentElement.style.setProperty('--color-primary', '#ff5722')
    document.documentElement.style.setProperty(
      '--color-primary-rgb',
      '255,87,34'
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography
        variant='h5'
        sx={{ mb: 2, background: 'var(--color-primary)' }}
      >
        Theme Test Component
      </Typography>

      {/* MUI button (uses palette -> CSS vars) */}
      <Button
        variant='contained'
        sx={{ mr: 2, background: 'var(--color-muteds)' }}
      >
        MUI Primary Button
      </Button>

      {/* SCSS styled button */}
      <button className='custom-btn'>SCSS Styled Button</button>

      <Box sx={{ mt: 3 }}>
        <Card sx={{ maxWidth: 400 }}>
          <CardContent>
            <Typography variant='body1'>
              This Card background uses <code>background.paper</code>
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              Text color comes from <code>text.primary</code>
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Box sx={{ mt: 3 }}>
        <Button onClick={toggleTheme} sx={{ mr: 2 }}>
          Toggle {dark ? 'Light' : 'Dark'} Theme
        </Button>
        <Button onClick={changePrimary}>Change Primary to Orange</Button>
      </Box>
    </Box>
  )
}
