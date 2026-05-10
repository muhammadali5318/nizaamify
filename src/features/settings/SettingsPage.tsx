import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useSession } from 'src/features/auth/AuthProvider'
import LanguageSelector from 'src/components/language-selector/LanguageSelector'
import { Button, Card } from 'src/components/ui'
import { PageHeader } from 'src/components/layout'
import { paths } from 'src/paths'

export default function SettingsPage() {
  const { t } = useTranslation(['common', 'tiers'])
  const { user } = useSession()
  const navigate = useNavigate()

  return (
    <Box sx={{ maxWidth: 672, mx: 'auto', width: '100%' }}>
      <PageHeader
        title={`${t('common:actions.edit')} — Settings`}
        subtitle={user?.email}
      />
      <Card>
        <Stack spacing={2}>
          <Stack direction='row' spacing={2} alignItems='center'>
            <Typography variant='body1'>
              {t('common:language.select_language')}:
            </Typography>
            <LanguageSelector />
          </Stack>
          <Divider />
          <Stack
            direction='row'
            justifyContent='space-between'
            alignItems='center'
          >
            <Box>
              <Typography variant='body1' sx={{ fontWeight: 600 }}>
                {t('tiers:title')}
              </Typography>
              <Typography variant='caption' sx={{ color: 'var(--text-muted)' }}>
                {t('tiers:subtitle')}
              </Typography>
            </Box>
            <Button variant='secondary' onClick={() => navigate(paths.tiers)}>
              {t('common:actions.edit')}
            </Button>
          </Stack>
        </Stack>
      </Card>
    </Box>
  )
}
