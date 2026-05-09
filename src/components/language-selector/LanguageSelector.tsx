import { MenuItem, Select, type SelectChangeEvent } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { supabase } from 'src/lib/supabase'
import { useSession } from 'src/features/auth/AuthProvider'

type Props = {
  size?: 'small' | 'medium'
  variant?: 'standard' | 'outlined'
}

export function LanguageSelector({
  size = 'small',
  variant = 'outlined'
}: Props) {
  const { i18n, t } = useTranslation('common')
  const { user } = useSession()

  const handleChange = async (e: SelectChangeEvent<string>) => {
    const next = e.target.value
    await i18n.changeLanguage(next)
    if (user) {
      void supabase
        .from('profiles')
        .update({ preferred_language: next })
        .eq('id', user.id)
    }
  }

  return (
    <Select
      value={i18n.language.startsWith('ur') ? 'ur' : 'en'}
      onChange={handleChange}
      size={size}
      variant={variant}
      aria-label={t('language.select_language')}
      sx={{ minWidth: 100 }}
    >
      <MenuItem value='en'>{t('language.english')}</MenuItem>
      <MenuItem value='ur'>{t('language.urdu')}</MenuItem>
    </Select>
  )
}

export default LanguageSelector
