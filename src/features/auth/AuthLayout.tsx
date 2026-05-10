import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import StorefrontIcon from '@mui/icons-material/Storefront'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import LanguageSelector from 'src/components/language-selector/LanguageSelector'
import { Card } from 'src/components/ui'

type Props = {
  title: string
  subtitle?: string
  children: ReactNode
}

/** Centered single-card layout used by every /auth/* screen. */
export function AuthLayout({ title, subtitle, children }: Props) {
  const { t } = useTranslation('common')

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        // Transparent so the body's ambient amber wash reads through.
        backgroundColor: 'transparent'
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2 }}>
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
        <Card variant='elevated' sx={{ width: '100%', p: { xs: 3, sm: 5 } }}>
          <Stack spacing={1.5} alignItems='center' mb={3}>
            <StorefrontIcon sx={{ fontSize: 40, color: 'var(--text-brand)' }} />
            <Typography variant='h3' sx={{ color: 'var(--text-primary)' }}>
              {t('app_name')}
            </Typography>
            <Typography
              variant='display'
              component='h1'
              sx={{ textAlign: 'center', color: 'var(--text-primary)' }}
            >
              {title}
            </Typography>
            {subtitle && (
              <Typography
                variant='body1'
                sx={{
                  textAlign: 'center',
                  color: 'var(--text-secondary)',
                  maxWidth: '52ch'
                }}
              >
                {subtitle}
              </Typography>
            )}
          </Stack>
          {children}
        </Card>
      </Container>
    </Box>
  )
}

export default AuthLayout
