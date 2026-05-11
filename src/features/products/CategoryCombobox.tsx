import { useEffect, useMemo, useState } from 'react'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import { useTranslation } from 'react-i18next'
import { Spinner } from 'src/components/ui'
import {
  useCategory,
  useCreateCategoryInline,
  useSearchCategories,
  type Category
} from './categoryHooks'
import CreateCategoryDialog from './CreateCategoryDialog'

const ADD_NEW_ID = '__add_new'

type Option = Category | { id: typeof ADD_NEW_ID; name: string; product_count: 0 }

type Props = {
  value: string | null
  onChange: (id: string | null) => void
  required?: boolean
  label?: string
  errorText?: string
  size?: 'small' | 'medium'
  disabled?: boolean
}

/**
 * Category picker for the product form. Same shape as the Product /
 * Supplier comboboxes — debounced fuzzy search via search_categories,
 * "+ Create new category" footer that opens an inline create dialog.
 */
export default function CategoryCombobox({
  value,
  onChange,
  required = false,
  label,
  errorText,
  size = 'medium',
  disabled = false
}: Props) {
  const { t } = useTranslation(['products', 'common'])
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [debounced, setDebounced] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const create = useCreateCategoryInline()

  useEffect(() => {
    const h = setTimeout(() => setDebounced(inputValue.trim()), 250)
    return () => clearTimeout(h)
  }, [inputValue])

  const search = useSearchCategories(debounced, 10)
  const { data: selected } = useCategory(value)

  const selectedOption: Category | null = useMemo(() => {
    if (!value || !selected) return null
    return { id: selected.id, name: selected.name, product_count: 0 }
  }, [value, selected])

  const options: Option[] = useMemo(() => {
    const base = (search.data ?? []) as Option[]
    return [
      ...base,
      {
        id: ADD_NEW_ID as const,
        name: t('products:category.add_new'),
        product_count: 0
      }
    ]
  }, [search.data, t])

  const isLoading = open && search.isFetching

  return (
    <>
      <Autocomplete<Option, false, boolean, false>
        size={size}
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        disabled={disabled}
        value={selectedOption}
        onChange={(_, next) => {
          if (!next) {
            onChange(null)
            return
          }
          if (next.id === ADD_NEW_ID) {
            setCreateOpen(true)
            return
          }
          onChange(next.id)
        }}
        inputValue={inputValue}
        onInputChange={(_, v, reason) => {
          if (reason !== 'reset') setInputValue(v)
        }}
        options={options}
        getOptionLabel={(o) => (typeof o === 'string' ? o : o.name)}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        filterOptions={(x) => x}
        loading={isLoading}
        disableClearable={required}
        noOptionsText={t('products:category.no_results')}
        renderOption={(props, option) => {
          const isSentinel = option.id === ADD_NEW_ID
          return (
            <li {...props} key={option.id}>
              {isSentinel ? (
                <Stack
                  direction='row'
                  spacing={1}
                  alignItems='center'
                  sx={{
                    width: '100%',
                    color: 'var(--text-brand)',
                    fontWeight: 600
                  }}
                >
                  <AddIcon fontSize='small' />
                  <Typography variant='body2' sx={{ color: 'inherit' }}>
                    {option.name}
                  </Typography>
                </Stack>
              ) : (
                <Box sx={{ width: '100%' }}>
                  <Stack
                    direction='row'
                    justifyContent='space-between'
                    alignItems='baseline'
                  >
                    <Typography variant='body1' sx={{ fontWeight: 600 }}>
                      {option.name}
                    </Typography>
                    <Typography
                      variant='caption'
                      sx={{ color: 'var(--text-muted)' }}
                    >
                      {t('products:category.count', {
                        count: (option as Category).product_count
                      })}
                    </Typography>
                  </Stack>
                </Box>
              )}
            </li>
          )
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label ?? t('products:fields.category')}
            placeholder={t('products:category.placeholder')}
            required={required}
            error={!!errorText}
            helperText={errorText}
            slotProps={{
              input: {
                ...params.InputProps,
                endAdornment: (
                  <>
                    {isLoading ? <Spinner size='inline' /> : null}
                    {params.InputProps.endAdornment}
                  </>
                )
              }
            }}
          />
        )}
      />

      <CreateCategoryDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        initialName={inputValue.trim()}
        submitting={create.isPending}
        onSubmit={async (name) => {
          const id = await create.mutateAsync(name)
          onChange(id)
          setCreateOpen(false)
          setInputValue('')
        }}
      />
    </>
  )
}
