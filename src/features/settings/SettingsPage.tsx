import { Box, Paper, Stack, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useSession } from 'src/features/auth/AuthProvider'
import LanguageSelector from 'src/components/language-selector/LanguageSelector'

export default function SettingsPage() {
  const { t } = useTranslation('common')
  const { user } = useSession()

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Paper sx={{ p: 4, borderRadius: 3 }}>
        <Stack spacing={2}>
          <Typography variant='h5' fontWeight={700}>
            {t('actions.edit')} — Settings
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            {user?.email}
          </Typography>
          <Stack direction='row' spacing={2} alignItems='center'>
            <Typography variant='body1'>
              {t('language.select_language')}:
            </Typography>
            <LanguageSelector />
          </Stack>
          <Typography variant='body2' color='text.secondary'>
            Settings placeholder — expanded in later milestones.
          </Typography>
        </Stack>
      </Paper>
    </Box>
  )
}
