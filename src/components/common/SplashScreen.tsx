import { Box, CircularProgress, Portal } from '@mui/material'

interface SplashScreenProps {
  portal?: boolean
  sx?: object
  [key: string]: unknown
}

export function SplashScreen({
  portal = true,
  sx = {},
  ...other
}: SplashScreenProps) {
  const content = (
    <Box sx={{ overflow: 'hidden' }}>
      <Box
        sx={{
          right: 0,
          width: 1,
          bottom: 0,
          height: 1,
          zIndex: 9998,
          display: 'flex',
          position: 'fixed',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#141a21',
          ...sx
        }}
        {...other}
      >
        <CircularProgress />
      </Box>
    </Box>
  )

  if (portal) {
    return <Portal>{content}</Portal>
  }

  return content
}
