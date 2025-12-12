import { Box, Button, Link, Stack, Typography } from '@mui/material'
import styles from './requireConsent.module.scss'
import { ChevronLeft } from '@mui/icons-material'
import RenderUlList from 'src/components/render-ul-list'

const RequireConsent = () => {
  return (
    <Box className={styles.selectYourBankRoot}>
      <Box className={styles.selectYourBankContainer}>
        <Button startIcon={<ChevronLeft />} variant='text' size='small'>
          Back
        </Button>
        <Stack spacing={1}>
          <Typography variant='h5' component='h1' fontWeight={700}>
            Consent Required
          </Typography>
          <Typography variant='body1' color='text.secondary'>
            Please review and confirm your consent
          </Typography>
        </Stack>
        <Box className={styles.consentContainer}>
          <Typography variant='body1' component='div' sx={{ lineHeight: 1.8 }}>
            We have partnered with <strong> Yapily Connect</strong> to access
            your bank data at Barclays.
            <br />
            <br />
            You will now be securely redirected to <strong>Barclays</strong> to
            give access to the following information:
            <br />
            <br />
            <RenderUlList
              variant='body1'
              fontWeight={400}
              items={['Account(s) details', 'Balances', 'Transaction history']}
            />
            <br />
            By using the service, you agree to Yapily Connect accessing your
            bank data, the{' '}
            <Link
              href='/terms-and-conditions' // replace with actual URL
              target='_blank'
              rel='noopener'
              color='info.main'
              underline='hover'
            >
              Terms & Conditions
            </Link>{' '}
            and{' '}
            <Link
              href='/privacy-notice' // replace with actual URL
              target='_blank'
              rel='noopener'
              color='info.main'
              underline='hover'
            >
              Privacy Notice
            </Link>
            .
            <br />
            <br />
            This consent will be valid until <strong>04/03/2026</strong>.
          </Typography>
        </Box>
        <Box width='100%' display='flex' gap={2.5}>
          <Button size='large' variant='outlined' sx={{ flex: 1 }}>
            Cancel
          </Button>
          <Button size='large' variant='contained' sx={{ flex: 1 }}>
            Confirm
          </Button>
        </Box>
      </Box>
    </Box>
  )
}

export default RequireConsent
