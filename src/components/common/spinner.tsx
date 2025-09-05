import React from 'react'
import { CircularProgress, Box } from '@mui/material'

const Spinner: React.FC = () => {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '30px',
        height: '30px',
        backgroundColor: 'transparent' // Optional background
      }}
    >
      <CircularProgress
        sx={{
          color: 'black' // Set the spinner color to black
        }}
        size={30} // Set spinner size
        thickness={4} // Adjust thickness
      />
    </Box>
  )
}

export default Spinner
