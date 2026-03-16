import { useEffect, useMemo, useState } from 'react'
import { Box, TextField, Button } from '@mui/material'
import { Controller, useForm } from 'react-hook-form'

import styles from './history.module.scss'
import DateRangeSelector, { RangeISO } from 'src/components/date-range-selector'
// import { useAuth } from 'src/context/AuthProvider'
import { useFetchSortedPaginatedData } from 'src/hooks/useFetchSortedData.'
import CloseIcon from '@mui/icons-material/Close'
import dayjs from 'dayjs'
import HistoryTable from './HistoryTable'
import useFetchTransactionsHistory from '../../hooks/useFetchTransactionsHistory'

type TechLogsFilters = {
  value?: string
  status?: string[]
  transactionType?: string[]
}

const FIELD_FLEX_SX = {
  flex: {
    xs: '1 1 100%',
    sm: '1 1 48%',
    md: '1 1 32%',
    lg: '1 1 22%'
  },
  minWidth: 0
} as const

/* small helper to normalize date values coming from the DateRangeSelector */
function normalizeDateValue(
  d: string | Date | null | undefined
): string | null {
  if (!d) return null

  const date = d instanceof Date ? dayjs(d) : dayjs(d)
  if (!date.isValid()) return null

  return date.format('DD-MM-YYYY')
}

const TransactionsHistory = () => {
  const {
    control,
    watch,
    formState: { errors },
    reset
  } = useForm<TechLogsFilters>({
    defaultValues: {
      value: '',
      status: [],
      transactionType: []
    }
  })

  const filters = watch()

  /* ---------- date range ---------- */
  const [range, setRange] = useState<RangeISO>({ start: null, end: null })

  const onClearFilters = () => {
    // Reset react-hook-form fields
    reset({
      value: '',
      status: [],
      transactionType: []
    })

    // Reset date range
    setRange({ start: null, end: null })

    // Reset pagination if needed
    setPage(0)
  }

  /* ---------- pagination + sorting ---------- */
  const { sortModel, page, pageSize, setPage, setPageSize, handleSortChange } =
    useFetchSortedPaginatedData()

  /* reset page when filters change */
  useEffect(() => {
    setPage(0)
  }, [
    filters.value,
    filters.status,
    filters.transactionType,
    range.start,
    range.end,
    setPage
  ])

  /* ---------- build ordering from sortModel (assumes MUI DataGrid-like model) ---------- */
  const ordering = useMemo(() => {
    if (
      !sortModel ||
      Array.isArray(sortModel) === false ||
      sortModel.length === 0
    )
      return undefined
    // take first sort instruction (backend expects single field ordering)
    const first = sortModel[0] as {
      field?: string
      sort?: 'asc' | 'desc' | null
    }
    if (!first?.field) return undefined
    return first.sort === 'desc' ? `-${first.field}` : first.field
  }, [sortModel])

  /* ---------- hook params ---------- */
  const search = filters.value ?? ''
  const start_date = normalizeDateValue(range.start)
  const end_date = normalizeDateValue(range.end)

  const { data, isLoading, isFetching } = useFetchTransactionsHistory({
    page,
    pageSize,
    search: search || undefined,
    ordering: ordering ?? undefined,
    start_date: start_date ?? undefined,
    end_date: end_date ?? undefined
  })

  return (
    <Box className={styles.contentRoot}>
      <Box p={'0px 16px 16px 16px'} width={'100%'}>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'stretch',
            gap: 2 // 16px gap between filters
          }}
        >
          {/* Search */}
          <Controller
            name='value'
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label='Search'
                placeholder='Search transactions...'
                sx={FIELD_FLEX_SX}
                error={!!errors.value}
              />
            )}
          />

          {/* Date range */}
          <Box sx={FIELD_FLEX_SX}>
            <DateRangeSelector
              value={range}
              onChange={setRange}
              label='Select date range'
            />
          </Box>
        </Box>
      </Box>
      <Box p={'0px 16px 16px 16px'} width={'100%'}>
        <Button
          startIcon={<CloseIcon />}
          variant='text'
          onClick={onClearFilters}
        >
          Clear Filters
        </Button>
      </Box>
      {/* Table */}
      <HistoryTable
        rows={data?.results}
        loading={isLoading || isFetching}
        sortModel={sortModel}
        handleSortChange={handleSortChange}
        page={page}
        pageSize={pageSize}
        setPage={setPage}
        setPageSize={setPageSize}
        total={data?.count}
        // you can pass total if your table supports server-side pagination display
        // total={total}
      />
    </Box>
  )
}

export default TransactionsHistory
