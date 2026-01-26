import { Box } from '@mui/material'

const AuthLayout = ({ children }) => {
  const isLoading = false
  return (
    <Box
      sx={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative'
      }}
    >
      {isLoading && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 10
          }}
        >
          <h2>Loading</h2>
        </Box>
      )}
      <Box
        sx={{
          width: '100vw',
          height: '100vh',
          zIndex: 10
        }}
      >
        {children}
      </Box>
    </Box>
  )
}

export default AuthLayout
