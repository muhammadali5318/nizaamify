import { Box, Button, Stack, Typography } from '@mui/material'
import styles from './connectionSuccessful.module.scss'
import { useNavigate } from 'react-router'
import { paths } from 'src/paths'

const ConnectionSuccessful = () => {
  const navigate = useNavigate()
  return (
    <Box className={styles.contectYourBankRoot}>
      <Box className={styles.contentWrapper}>
        <Stack spacing={{ xs: 2, sm: 2 }} alignItems='center'>
          <img
            src='/assets/success-check.svg'
            alt='bank icon'
            style={{
              width: 'min(126px, 80vw)',
              height: 'auto'
            }}
          />

          <Stack spacing={1} alignItems='center' textAlign='center'>
            <Typography variant='h5' component='h1' fontWeight={700}>
              Connection Established Successfully{' '}
            </Typography>
            <Typography variant='body1' color='text.secondary'>
              Your Barclays account has been connected to Monai.
              <br />
              <br />
              We can now securely access your account balances and transaction
              history.
            </Typography>
          </Stack>

          <Button
            size='large'
            variant='contained'
            onClick={() => navigate(paths.dashboard)}
            fullWidth
          >
            Go to Dashboard
          </Button>
        </Stack>
      </Box>
    </Box>
  )
}

export default ConnectionSuccessful
