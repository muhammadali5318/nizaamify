import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { useSession } from 'src/features/auth/AuthProvider'
import LanguageSelector from 'src/components/language-selector/LanguageSelector'
import { Card } from 'src/components/ui'
import { PageHeader } from 'src/components/layout'

export default function SettingsPage() {
  const { t } = useTranslation('common')
  const { user } = useSession()

  return (
    <Box sx={{ maxWidth: 672, mx: 'auto', width: '100%' }}>
      <PageHeader
        title={`${t('actions.edit')} — Settings`}
        subtitle={user?.email}
      />
      <Card>
        <Stack spacing={2}>
          <Stack direction='row' spacing={2} alignItems='center'>
            <Typography variant='body1'>
              {t('language.select_language')}:
            </Typography>
            <LanguageSelector />
          </Stack>
          <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
            Settings placeholder — expanded in later milestones.
          </Typography>
        </Stack>
      </Card>
    </Box>
  )
}
