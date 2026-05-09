import React, { ReactNode } from 'react'
import { Box } from '@mui/material'
import Spinner from 'src/components/common/spinner'

type ChildrenProp = {
  children: ReactNode
}

const PageLoader: React.FC<ChildrenProp> = () => {
  const isLoading = true // Replace with actual loading state.

  return (
    <Box
      sx={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8f9fa', // Optional: page background
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
            inset: 0,
            backgroundColor: 'white', // Optional: overlay background
            zIndex: 10
          }}
        >
          <Spinner /> {/* Using custom Spinner */}
        </Box>
      )}
      <Box
        sx={{
          p: 4,
          boxShadow: 3,
          borderRadius: 2,
          backgroundColor: 'white',
          maxWidth: 400,
          width: '100%',
          zIndex: 1 // Ensures content appears below the spinner
        }}
      ></Box>
    </Box>
  )
}

export default PageLoader
