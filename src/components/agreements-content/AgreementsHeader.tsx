import { ChevronLeft } from '@mui/icons-material'
import { Box, IconButton, Button, useMediaQuery, useTheme } from '@mui/material'

const AgreementsHeader = () => {
  const theme = useTheme()
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm')) // <600px

  const handleClose = () => {
    window.close()
  }

  return (
    <Box
      p={2}
      width='100%'
      display='flex'
      justifyContent='center'
      alignItems='center'
      position='relative'
    >
      <img src='/assets/monai-white.svg' alt='monai logo' />

      {isSmallScreen ? (
        <IconButton
          onClick={handleClose}
          sx={{
            position: 'absolute',
            top: 16,
            left: 16,
            color: '#FFF',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.2)'
            }
          }}
        >
          <ChevronLeft />
        </IconButton>
      ) : (
        <Button
          onClick={handleClose}
          startIcon={<ChevronLeft />}
          variant='outlined'
          size='large'
          sx={{
            color: '#FFF',
            borderColor: '#FFF',
            position: 'absolute',
            top: 16,
            left: 16
          }}
        >
          Go back
        </Button>
      )}
    </Box>
  )
}

export default AgreementsHeader
