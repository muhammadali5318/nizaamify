import { useEffect, useMemo, useState } from 'react'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import { useTranslation } from 'react-i18next'
import { Spinner } from 'src/components/ui'
import { formatPKR } from 'src/features/subscription/env'
import {
  useProduct,
  useRecentPurchaseProducts,
  useSearchProducts,
  type RecentPurchaseProduct,
  type ProductSearchRow
} from './hooks'
import AddProductInlineDialog from './AddProductInlineDialog'

const PAGE_SIZE = 10
const ADD_NEW_ID = '__add_new'
const LOAD_MORE_ID = '__load_more'

type Option = {
  id: string
  name: string
  type: string
  stock: number
  avg_cost: number
}

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
 * Product picker for stock-in form. Same pattern as SupplierCombobox /
 * CustomerPicker — debounced fuzzy search via search_products, recent stock-in
 * products as the empty-state, "+ Create new product" footer item.
 */
export default function ProductCombobox({
  value,
  onChange,
  required = false,
  label,
  errorText,
  size = 'small',
  disabled = false
}: Props) {
  const { t, i18n } = useTranslation(['products', 'common', 'purchases'])
  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'
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

  const recent = useRecentPurchaseProducts(PAGE_SIZE)
  const search = useSearchProducts({
    query: debounced,
    page,
    pageSize: PAGE_SIZE
  })

  useEffect(() => {
    if (!search.data || debounced.length === 0) return
    setAccumulated((prev) => {
      const merged = [...prev]
      const seen = new Set(prev.map((p) => p.id))
      for (const row of search.data.rows as ProductSearchRow[]) {
        if (!seen.has(row.id)) {
          merged.push({
            id: row.id,
            name: row.name,
            type: row.type,
            stock: row.stock,
            avg_cost: row.avg_cost
          })
          seen.add(row.id)
        }
      }
      return merged
    })
  }, [search.data, debounced])

  const { data: selected } = useProduct(value ?? undefined)
  const selectedOption: Option | null = useMemo(() => {
    if (!value || !selected) return null
    return {
      id: selected.id,
      name: selected.name,
      type: selected.type,
      stock: selected.stock,
      avg_cost: Number(selected.avg_cost)
    }
  }, [value, selected])

  const baseOptions: Option[] = useMemo(() => {
    if (debounced.length === 0) {
      return (recent.data ?? []).map((r: RecentPurchaseProduct) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        stock: r.stock,
        avg_cost: Number(r.avg_cost)
      }))
    }
    return accumulated
  }, [debounced, recent.data, accumulated])

  const lastBatch = (search.data?.rows ?? []) as ProductSearchRow[]
  const showLoadMore = debounced.length > 0 && lastBatch.length === PAGE_SIZE

  const options: Option[] = useMemo(() => {
    const out: Option[] = [...baseOptions]
    if (showLoadMore) {
      out.push({
        id: LOAD_MORE_ID,
        name: t('common:actions.load_more', 'Load more'),
        type: '',
        stock: 0,
        avg_cost: 0
      })
    }
    out.push({
      id: ADD_NEW_ID,
      name: t('purchases:form.add_new_product'),
      type: '',
      stock: 0,
      avg_cost: 0
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
        disableClearable={required}
        noOptionsText={t('products:no_results', 'No products found')}
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
                      {t('products:fields.stock', 'Stock')}: {option.stock}
                    </Typography>
                  </Stack>
                  <Stack direction='row' spacing={1.5}>
                    <Typography
                      variant='caption'
                      sx={{ color: 'var(--text-muted)' }}
                    >
                      {option.type}
                    </Typography>
                    <Typography
                      variant='caption'
                      sx={{ color: 'var(--text-muted)' }}
                    >
                      {t('products:fields.avg_cost', 'Avg cost')}:{' '}
                      {formatPKR(option.avg_cost, locale)}
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
            label={label ?? t('purchases:fields.product')}
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

      <AddProductInlineDialog
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
