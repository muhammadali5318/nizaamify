import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import { useTranslation } from 'react-i18next'
import { useSearchCategories } from './categoryHooks'

type Props = {
  value: string | null
  onChange: (id: string | null) => void
}

/**
 * Single-select category filter for the products list (v2.5 §7).
 * Top 10 categories by usage; selecting one calls onChange with the id,
 * "All categories" clears the filter.
 */
export default function CategoryFilter({ value, onChange }: Props) {
  const { t } = useTranslation(['products', 'common'])
  const { data: categories } = useSearchCategories('', 10)

  return (
    <TextField
      select
      size='small'
      label={t('products:category.filter_label')}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
      sx={{ minWidth: 200 }}
    >
      <MenuItem value=''>{t('products:category.filter_all')}</MenuItem>
      {(categories ?? []).map((c) => (
        <MenuItem key={c.id} value={c.id}>
          {c.name}
        </MenuItem>
      ))}
    </TextField>
  )
}
