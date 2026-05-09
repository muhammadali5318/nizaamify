import { Box, CircularProgress } from '@mui/material'

export function FullPageSpinner() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <CircularProgress />
    </Box>
  )
}

export default FullPageSpinner
