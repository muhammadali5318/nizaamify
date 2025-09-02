import { Box } from '@mui/material'

const AuthLayout = ({ children }) => {
  const isLoading = true

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
          <h2>Loadling</h2>
        </Box>
      )}
      <Box
        sx={{
          p: 4,
          boxShadow: 3,
          borderRadius: 2,
          backgroundColor: '#141a21',
          maxWidth: 400,
          width: '100%',
          zIndex: 1
        }}
      >
        {children}
      </Box>
    </Box>
  )
}

export default AuthLayout
