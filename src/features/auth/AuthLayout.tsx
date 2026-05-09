import { Box, Container, Paper, Stack, Typography } from '@mui/material'
import StorefrontIcon from '@mui/icons-material/Storefront'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import LanguageSelector from 'src/components/language-selector/LanguageSelector'

type Props = {
  title: string
  subtitle?: string
  children: ReactNode
}

export function AuthLayout({ title, subtitle, children }: Props) {
  const { t } = useTranslation('common')

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default'
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          p: 2
        }}
      >
        <LanguageSelector />
      </Box>

      <Container
        maxWidth='sm'
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          py: 4
        }}
      >
        <Paper
          elevation={2}
          sx={{
            width: '100%',
            p: { xs: 3, sm: 5 },
            borderRadius: 3
          }}
        >
          <Stack spacing={1.5} alignItems='center' mb={3}>
            <StorefrontIcon sx={{ fontSize: 40, color: 'primary.main' }} />
            <Typography variant='h6' fontWeight={700}>
              {t('app_name')}
            </Typography>
            <Typography variant='h5' fontWeight={700} textAlign='center'>
              {title}
            </Typography>
            {subtitle && (
              <Typography
                variant='body2'
                color='text.secondary'
                textAlign='center'
              >
                {subtitle}
              </Typography>
            )}
          </Stack>
          {children}
        </Paper>
      </Container>
    </Box>
  )
}

export default AuthLayout
