import React, { useEffect, useState } from 'react'
import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Checkbox,
  ListItemText,
  OutlinedInput,
  Button
} from '@mui/material'
import { Controller, useForm } from 'react-hook-form'

import styles from './reconcialiation.module.scss'
import DateRangeSelector, { RangeISO } from 'src/components/date-range-selector'
// import { useAuth } from 'src/context/AuthProvider'
import { useFetchSortedPaginatedData } from 'src/hooks/useFetchSortedData.'
import CloseIcon from '@mui/icons-material/Close'
import ReconciliationTable from '../reconciliation-table'

/* =======================
   Types
======================= */

type TechLogsFilters = {
  value?: string
  status?: string[]
  transactionType?: string[]
}

type Option = {
  value: string
  label: string
}

/* =======================
   Constants
======================= */

const STAUS: Option[] = []

const TRANSACTION_TYPE: Option[] = []

const FIELD_FLEX_SX = {
  flex: {
    xs: '1 1 100%', // mobile - full width
    sm: '1 1 48%', // small screen - 2 per row
    md: '1 1 32%', // medium - 3 per row
    lg: '1 1 22%' // large - 4 per row (slightly less than 25% to account for gap)
  },
  minWidth: 0
} as const

/* =======================
   Helpers
======================= */

const joinLabels = (options: Option[] | undefined, values?: string[]) =>
  (values || [])
    .map((v) => options?.find((o) => o.value === v)?.label ?? v)
    .join(', ')

/* =======================
   Component
======================= */

const ReconciliationContent: React.FC = () => {
  // const { accessToken } = useAuth()

  /* ---------- form ---------- */
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
    range.end
  ])

  /* =======================
     Render
  ======================= */

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

          {/* Transactions Type (was Logs category) */}
          <FormControl sx={FIELD_FLEX_SX}>
            <InputLabel id='transactions-type-label'>
              Transactions Type
            </InputLabel>
            <Controller
              name='transactionType'
              control={control}
              render={({ field }) => {
                const selected = Array.isArray(field.value) ? field.value : []

                const handleChange = (event: any) => {
                  const value = event.target.value
                  if (value.includes('')) field.onChange([])
                  else field.onChange(value)
                }

                return (
                  <Select
                    multiple
                    value={selected}
                    onChange={handleChange}
                    input={<OutlinedInput label='Transactions Type' />}
                    renderValue={() =>
                      selected.length
                        ? joinLabels(TRANSACTION_TYPE as any, selected)
                        : 'All'
                    }
                  >
                    <MenuItem value=''>
                      <em>All</em>
                    </MenuItem>
                    {TRANSACTION_TYPE?.map((o: any) => (
                      <MenuItem key={o.key} value={o.value}>
                        <Checkbox checked={selected.includes(o.value)} />
                        <ListItemText primary={o.value} />
                      </MenuItem>
                    ))}
                  </Select>
                )
              }}
            />
          </FormControl>

          {/* Status (was Action type) */}
          <FormControl sx={FIELD_FLEX_SX}>
            <InputLabel id='status-label'>Status</InputLabel>
            <Controller
              name='status'
              control={control}
              render={({ field }) => {
                const selected = Array.isArray(field.value) ? field.value : []

                const handleChange = (event: any) => {
                  const value = event.target.value
                  if (value.includes('')) field.onChange([])
                  else field.onChange(value)
                }

                return (
                  <Select
                    multiple
                    value={selected}
                    onChange={handleChange}
                    input={<OutlinedInput label='Status' />}
                    renderValue={() =>
                      selected.length ? joinLabels(STAUS, selected) : 'All'
                    }
                  >
                    <MenuItem value=''>
                      <em>All</em>
                    </MenuItem>
                    {STAUS.map((o) => (
                      <MenuItem key={o.value} value={o.value}>
                        <Checkbox checked={selected.includes(o.value)} />
                        <ListItemText primary={o.label} />
                      </MenuItem>
                    ))}
                  </Select>
                )
              }}
            />
          </FormControl>

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
      <ReconciliationTable
        data={[]}
        loading={false}
        sortModel={sortModel}
        handleSortChange={handleSortChange}
        page={page}
        pageSize={pageSize}
        setPage={setPage}
        setPageSize={setPageSize}
      />
    </Box>
  )
}

export default ReconciliationContent
