import { Box, Chip, Stack, Typography } from '@mui/material'
import styles from './AgreementContent.module.scss'
import RegistrationWrapper from '../registration-wrapper/RegistrationWrapper'
import AgreementsHeader from './AgreementsHeader'

const AgreementContent = () => {
  return (
    <RegistrationWrapper>
      <Box width={'100%'} height={'100%'}>
        <Stack className={styles.wrapper}>
          <Box width={'100%'} height={'100%'} position={'relative'}>
            <AgreementsHeader />
            <Stack
              spacing={1.5}
              alignItems='center'
              position={'absolute'}
              top='50%'
              left='50%'
              sx={{ transform: 'translate(-50%, -50%)' }}
            >
              <Chip
                label='Terms & Conditions'
                color='info'
                variant='outlined'
              />
              <Typography
                textAlign={'center'}
                color='#fff'
                variant='h3'
                fontWeight={700}
              >
                Monai Tech Terms of Service
              </Typography>
            </Stack>
          </Box>
        </Stack>
        <Box>Body</Box>
      </Box>
    </RegistrationWrapper>
  )
}

export default AgreementContent
