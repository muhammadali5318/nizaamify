import { useEffect, useMemo, useState } from 'react'
import {
  Autocomplete,
  Box,
  CircularProgress,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { useTranslation } from 'react-i18next'
import {
  useCustomer,
  useCustomerSearch,
  useRecentCustomers,
  type RecentCustomer
} from './hooks'
import AddCustomerDialog from 'src/features/pos/AddCustomerDialog'

const PAGE_SIZE = 10
const ADD_NEW_ID = '__add_new'
const LOAD_MORE_ID = '__load_more'

type Option = {
  id: string
  name: string
  phone: string
  address: string | null
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

const truncate = (s: string, n = 40) =>
  s.length > n ? `${s.slice(0, n - 1)}…` : s

export default function CustomerPicker({
  value,
  onChange,
  required = false,
  clearable = true,
  label,
  errorText,
  size = 'small',
  disabled = false
}: Props) {
  const { t } = useTranslation(['pos', 'customers', 'common'])
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [debounced, setDebounced] = useState('')
  const [offset, setOffset] = useState(0)
  const [accumulated, setAccumulated] = useState<Option[]>([])
  const [addOpen, setAddOpen] = useState(false)

  // Debounce input changes
  useEffect(() => {
    const h = setTimeout(() => setDebounced(inputValue.trim()), 250)
    return () => clearTimeout(h)
  }, [inputValue])

  // Reset accumulated and offset when query changes
  useEffect(() => {
    setOffset(0)
    setAccumulated([])
  }, [debounced])

  const recent = useRecentCustomers(PAGE_SIZE)
  const search = useCustomerSearch({
    query: debounced,
    offset,
    pageSize: PAGE_SIZE,
    enabled: open
  })

  // Append search results into accumulated when they arrive (offset-based)
  useEffect(() => {
    if (!search.data || debounced.length === 0) return
    setAccumulated((prev) => {
      // Avoid double-append for the same offset key by merging by id
      const merged = [...prev]
      const seen = new Set(prev.map((p) => p.id))
      for (const row of search.data) {
        if (!seen.has(row.id)) {
          merged.push(row as Option)
          seen.add(row.id)
        }
      }
      return merged
    })
  }, [search.data, debounced])

  // Selected customer (kept in sync so the field can render the chosen name
  // even when the listbox is closed/empty).
  const { data: selectedCustomer } = useCustomer(value ?? undefined)

  const selectedOption: Option | null = useMemo(() => {
    if (!value) return null
    if (selectedCustomer) {
      return {
        id: selectedCustomer.id,
        name: selectedCustomer.name,
        phone: selectedCustomer.phone,
        address: selectedCustomer.address ?? null
      }
    }
    return null
  }, [value, selectedCustomer])

  // Build the options list shown in the dropdown
  const baseOptions: Option[] = useMemo(() => {
    if (debounced.length === 0) {
      return (recent.data ?? []).map((r: RecentCustomer) => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        address: r.address
      }))
    }
    return accumulated
  }, [debounced, recent.data, accumulated])

  const lastBatch = search.data ?? []
  const showLoadMore = debounced.length > 0 && lastBatch.length === PAGE_SIZE

  const options: (
    | Option
    | { id: string; name: string; phone: string; address: null }
  )[] = useMemo(() => {
    const out: typeof options = [...baseOptions]
    if (showLoadMore) {
      out.push({
        id: LOAD_MORE_ID,
        name: t('pos:customer.load_more'),
        phone: '',
        address: null
      })
    }
    out.push({
      id: ADD_NEW_ID,
      name: t('pos:customer.add_new'),
      phone: '',
      address: null
    })
    return out
  }, [baseOptions, showLoadMore, t])

  const isLoading =
    (debounced.length === 0 ? recent.isLoading : search.isFetching) && open

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
            // Don't change selection; dialog onCreated will set it.
            return
          }
          if (next.id === LOAD_MORE_ID) {
            setOffset((o) => o + PAGE_SIZE)
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
        noOptionsText={t('pos:customer.no_results')}
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
                        ? 'primary.main'
                        : 'text.secondary',
                    fontWeight: 600
                  }}
                >
                  {option.id === ADD_NEW_ID && <AddIcon fontSize='small' />}
                  <Typography variant='body2'>{option.name}</Typography>
                </Stack>
              ) : (
                <Box sx={{ width: '100%' }}>
                  <Typography variant='body2' fontWeight={700}>
                    {option.name}
                  </Typography>
                  <Typography variant='caption' color='text.secondary'>
                    {option.phone}
                  </Typography>
                  {option.address && (
                    <Typography
                      variant='caption'
                      color='text.secondary'
                      display='block'
                    >
                      {truncate(option.address, 40)}
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
            label={label ?? t('pos:payment.customer')}
            required={required}
            error={!!errorText}
            helperText={errorText}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {isLoading ? (
                    <CircularProgress color='inherit' size={16} />
                  ) : null}
                  {params.InputProps.endAdornment}
                </>
              )
            }}
          />
        )}
      />

      <AddCustomerDialog
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
