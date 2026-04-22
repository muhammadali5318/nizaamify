import { Box, Button, Stack, Typography } from '@mui/material'
import styles from './resetMfa.module.scss'
import PageHeader from 'src/components/page-header'
import { useState } from 'react'
import ResetMfaModal from './ResetMfaModal'

const ResetMFA = () => {
  const [openModal, setOpenModal] = useState(false)

  return (
    <Box className={styles.resetMFARoot}>
      <PageHeader
        title={'2 Factor Authentication'}
        logoWidth={40}
        logoHeight={40}
        descriptionVariant='body1'
        headerAlignItems='start'
        description={
          'Make your account extra secure. Along with your password, you’ll need to enter a code'
        }
        logo={'/assets/Info-outlined.svg'}
      />
      <Stack>
        <Typography variant='h6' fontWeight={500}>
          Current Authentications
        </Typography>
        <Typography variant='body1' color='text.secondary'>
          This will change the email you log in with and receive emails from
          Monai Tech.
        </Typography>
      </Stack>
      <Box className={styles.resetBox}>
        <Typography variant='h6' fontWeight={500}>
          Authentication App (One-time code)
        </Typography>
        <Button
          color='error'
          variant='outlined'
          size='large'
          onClick={() => setOpenModal(true)}
        >
          Reset MFA
        </Button>
      </Box>
      <Stack>
        <Typography variant='h6' fontWeight={500}>
          What will resetting your 2 Factor Authentication mean?{' '}
        </Typography>
        <Typography variant='body1' color='text.secondary'>
          By resetting your 2-Factor Authentication (2FA) settings, the approach
          already in place will be removed. <br /> <br /> This means you will
          not be able to access secure areas until you re-enable 2FA. This
          action is recommended only if you need to update or reset your
          authentication method. If you confirm you wish to you’ll be able to
          authenticate again.
        </Typography>
      </Stack>
      <ResetMfaModal open={openModal} onClose={() => setOpenModal(false)} />
    </Box>
  )
}

export default ResetMFA
