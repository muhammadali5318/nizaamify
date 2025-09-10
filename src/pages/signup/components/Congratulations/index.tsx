import { Box, Button, Typography } from '@mui/material'
import RegistrationWrapper from 'src/components/registration-wrapper/RegistrationWrapper'
import styles from './Congratulations.module.scss'
import RegistrationHeader from 'src/components/registration-wrapper/RegistrationHeader'

const Congratulations = () => {
  return (
    <RegistrationWrapper>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          height: '100%',
          px: 2
        }}
      >
        <RegistrationHeader />
        <Box className={styles.congratulationsRoot}>
          <Box className={styles.congratulationsContainer}>
            <Box className='center-align-width--100'>
              <img src='/assets/congrats.svg' alt='congratc icon' />
            </Box>
            <Box className={styles.congratsInfoContainer}>
              <Typography variant='h4' className='font-weight--700'>
                Congratulation!{' '}
              </Typography>
              <Typography
                sx={{
                  width: '364px',
                  textAlign: 'center'
                }}
                variant='subtitle1'
                color='var(--color-text-secondary)'
              >
                Your email has been verified and your Account has been created
                successfully.
              </Typography>
            </Box>
            <Box className='center-align-width--100'>
              <Button size='large' variant='contained'>
                Continue
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>
    </RegistrationWrapper>
  )
}

export default Congratulations
