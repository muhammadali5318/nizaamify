import { useEffect, useMemo, useState } from 'react'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import { useTranslation } from 'react-i18next'
import { Spinner } from 'src/components/ui'
import AddSupplierDialog from './AddSupplierDialog'
import {
  useRecentSuppliers,
  useSearchSuppliers,
  useSupplier,
  type RecentSupplier,
  type SupplierSearchRow
} from './hooks'

const PAGE_SIZE = 10
const ADD_NEW_ID = '__add_new'
const LOAD_MORE_ID = '__load_more'

type Option = {
  id: string
  name: string
  contact: string | null
}

type Props = {
  value: string | null
  onChange: (id: string | null) => void
  required?: boolean
  clearable?: boolean
  label?: string
  errorText?: string
  size?: 'small' | 'medium'
  disabled?: boolean
}

/**
 * Supplier picker — mirrors CustomerPicker (debounced search + recent +
 * accumulated load-more + inline create). Used by the stock-in form and the
 * stock-in list filter.
 */
export default function SupplierCombobox({
  value,
  onChange,
  required = false,
  clearable = true,
  label,
  errorText,
  size = 'small',
  disabled = false
}: Props) {
  const { t } = useTranslation(['suppliers', 'common'])
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(0)
  const [accumulated, setAccumulated] = useState<Option[]>([])
  const [addOpen, setAddOpen] = useState(false)

  useEffect(() => {
    const h = setTimeout(() => setDebounced(inputValue.trim()), 250)
    return () => clearTimeout(h)
  }, [inputValue])

  useEffect(() => {
    setPage(0)
    setAccumulated([])
  }, [debounced])

  const recent = useRecentSuppliers(PAGE_SIZE)
  const search = useSearchSuppliers({
    query: debounced,
    page,
    pageSize: PAGE_SIZE,
    enabled: open && debounced.length > 0
  })

  useEffect(() => {
    if (!search.data || debounced.length === 0) return
    setAccumulated((prev) => {
      const merged = [...prev]
      const seen = new Set(prev.map((p) => p.id))
      for (const row of search.data.rows as SupplierSearchRow[]) {
        if (!seen.has(row.id)) {
          merged.push({ id: row.id, name: row.name, contact: row.contact })
          seen.add(row.id)
        }
      }
      return merged
    })
  }, [search.data, debounced])

  const { data: selected } = useSupplier(value ?? undefined)
  const selectedOption: Option | null = useMemo(() => {
    if (!value || !selected) return null
    return { id: selected.id, name: selected.name, contact: selected.contact }
  }, [value, selected])

  const baseOptions: Option[] = useMemo(() => {
    if (debounced.length === 0) {
      return (recent.data ?? []).map((r: RecentSupplier) => ({
        id: r.id,
        name: r.name,
        contact: r.contact
      }))
    }
    return accumulated
  }, [debounced, recent.data, accumulated])

  const lastBatch = (search.data?.rows ?? []) as SupplierSearchRow[]
  const showLoadMore = debounced.length > 0 && lastBatch.length === PAGE_SIZE

  const options: Option[] = useMemo(() => {
    const out: Option[] = [...baseOptions]
    if (showLoadMore) {
      out.push({
        id: LOAD_MORE_ID,
        name: t('common:actions.load_more'),
        contact: null
      })
    }
    out.push({
      id: ADD_NEW_ID,
      name: t('suppliers:actions.new_supplier'),
      contact: null
    })
    return out
  }, [baseOptions, showLoadMore, t])

  const isLoading =
    open && (debounced.length === 0 ? recent.isLoading : search.isFetching)

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
            setAddOpen(true)
            return
          }
          if (next.id === LOAD_MORE_ID) {
            setPage((p) => p + 1)
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
        disableClearable={!clearable || required}
        noOptionsText={t('suppliers:no_results')}
        renderOption={(props, option) => {
          const isSentinel =
            option.id === ADD_NEW_ID || option.id === LOAD_MORE_ID
          return (
            <li {...props} key={option.id}>
              {isSentinel ? (
                <Stack
                  direction='row'
                  spacing={1}
                  alignItems='center'
                  sx={{
                    width: '100%',
                    color:
                      option.id === ADD_NEW_ID
                        ? 'var(--text-brand)'
                        : 'var(--text-muted)',
                    fontWeight: 600
                  }}
                >
                  {option.id === ADD_NEW_ID && <AddIcon fontSize='small' />}
                  <Typography variant='body2' sx={{ color: 'inherit' }}>
                    {option.name}
                  </Typography>
                </Stack>
              ) : (
                <Box sx={{ width: '100%' }}>
                  <Typography variant='body1' sx={{ fontWeight: 600 }}>
                    {option.name}
                  </Typography>
                  {option.contact && (
                    <Typography
                      variant='caption'
                      sx={{ color: 'var(--text-muted)' }}
                    >
                      {option.contact}
                    </Typography>
                  )}
                </Box>
              )}
            </li>
          )
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label ?? t('suppliers:fields.name')}
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

      <AddSupplierDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(id) => {
          onChange(id)
          setAddOpen(false)
        }}
      />
    </>
  )
}
