import { Box, Divider, Stack, Typography } from '@mui/material'
import styles from './Footer.module.scss'
import { paths } from 'src/paths'
import { useAuth } from 'src/context/AuthProvider'

const Footer = () => {
  const { accessToken } = useAuth()
  const PRIVACY_PATH = accessToken
    ? `${paths.agreements}?doc=privacy`
    : '/auth/signup/agreements?doc=privacy'
  const TERMS_PATH = accessToken
    ? `${paths.agreements}?doc=terms`
    : '/auth/signup/agreements?doc=terms'

  return (
    <Box
      className={styles.footerRoot}
      sx={{
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: { xs: 'center', sm: 'space-between' },
        alignItems: 'center',
        px: { xs: 2, sm: 6 },
        py: { xs: 2, sm: 1 }
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        gap={1.1}
        alignItems='center'
        sx={{ width: { xs: '100%', sm: 'auto' } }}
      >
        <Typography
          onClick={() => window.open(PRIVACY_PATH, '_blank')}
          variant='subtitle2'
          color='var(--color-text-secondary)'
          sx={{
            fontSize: { xs: '0.75rem', sm: '0.875rem', cursor: 'pointer' }
          }}
        >
          Privacy Policy
        </Typography>

        {/* vertical on sm+, horizontal on xs */}
        <Divider
          orientation='vertical'
          flexItem
          sx={{ display: { xs: 'none', sm: 'block' }, mx: 1 }}
        />
        <Divider
          orientation='horizontal'
          flexItem
          sx={{ display: { xs: 'block', sm: 'none' }, width: '90%', my: 0.5 }}
        />

        <Typography
          onClick={() => window.open(TERMS_PATH, '_blank')}
          variant='subtitle2'
          color='var(--color-text-secondary)'
          sx={{
            fontSize: { xs: '0.75rem', sm: '0.875rem' },
            cursor: 'pointer'
          }}
        >
          Terms & Conditions
        </Typography>
      </Stack>

      <Typography
        variant='subtitle2'
        color='var(--color-text-secondary)'
        align='center'
        sx={{
          fontSize: { xs: '0.7rem', sm: '0.875rem' },
          mt: { xs: 1.25, sm: 0 }
        }}
      >
        Copyright © {new Date().getFullYear()} Monai tech. All rights reserved.
      </Typography>
    </Box>
  )
}

export default Footer
