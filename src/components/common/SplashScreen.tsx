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
          // inset:0 pins to all four edges; logical, RTL-safe, replaces
          // the old right/bottom + width:1 + height:1 fullscreen recipe.
          inset: 0,
          zIndex: 9998,
          display: 'flex',
          position: 'fixed',
          alignItems: 'center',
          justifyContent: 'center',
          ...sx
        }}
        {...other}
      >
        <CircularProgress
          sx={{
            color: 'black' // Set the spinner color to black
          }}
          size={30} // Set spinner size
          thickness={4} // Adjust thickness
        />
      </Box>
    </Box>
  )

  if (portal) {
    return <Portal>{content}</Portal>
  }

  return content
}
