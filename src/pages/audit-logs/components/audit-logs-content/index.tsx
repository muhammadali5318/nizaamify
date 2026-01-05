import React, { useEffect, useMemo, useState } from 'react'
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

import styles from '../../auditLogs.module.scss'
import { USER_ROLES } from 'src/const'
import DateRangeSelector, { RangeISO } from 'src/components/date-range-selector'
import { useAuth } from 'src/context/AuthProvider'
import AuditLogsTable from '../audit-logs-table'
import { useFetchAuditLogsList } from '../../hooks/useFetchAuditLogsList'
import { useFetchSortedPaginatedData } from 'src/hooks/useFetchSortedData.'
import CloseIcon from '@mui/icons-material/Close'

/* =======================
   Types
======================= */

type TechLogsFilters = {
  value?: string
  role?: string[]
  actionType?: string[]
  logsCategory?: string[]
}

type Option = {
  value: string
  label: string
}

/* =======================
   Constants
======================= */

const ACTION_TYPE_OPTIONS: Option[] = [
  { value: 'READ', label: 'Read' },
  { value: 'CREATED', label: 'Created' },
  { value: 'UPDATED', label: 'Updated' },
  { value: 'DELETED', label: 'Deleted' },
  { value: 'UPSERT', label: 'Upsert' }
]

const LOGS_CATEGORY_OPTIONS: Option[] = [
  { value: 'Sign Up', label: 'Sign Up' },
  { value: 'Login', label: 'Login' },
  { value: 'Logout', label: 'Logout' },
  { value: 'Pratice Onboarding', label: 'Pratice Onboarding' },
  { value: 'Subscriptions - Billing', label: 'Subscriptions - Billing' },
  { value: 'KPI Configurations', label: 'KPI Configurations' },
  { value: 'Manual Entries', label: 'Manual Entries' },
  { value: 'Upload Document', label: 'Upload Document' },
  { value: 'Practice Profile', label: 'Practice Profile' },
  { value: 'Practice Settings', label: 'Practice Settings' }
]

const FIELD_FLEX_SX = {
  flex: { xs: '0 0 100%', sm: '0 0 357px' },
  width: { xs: '100%', sm: '357px' }
} as const

/* =======================
   Helpers
======================= */

const joinLabels = (options: Option[], values?: string[]) =>
  (values || [])
    .map((v) => options.find((o) => o.value === v)?.label ?? v)
    .join(', ')

/* =======================
   Component
======================= */

const AuditLogsContent: React.FC = () => {
  const { accessToken } = useAuth()

  /* ---------- form ---------- */
  const {
    control,
    watch,
    formState: { errors },
    reset
  } = useForm<TechLogsFilters>({
    defaultValues: {
      value: '',
      role: [],
      actionType: [],
      logsCategory: []
    }
  })

  const filters = watch()

  /* ---------- date range ---------- */
  const [range, setRange] = useState<RangeISO>({ start: null, end: null })

  const onClearFilters = () => {
    // Reset react-hook-form fields
    reset({
      value: '',
      role: [],
      actionType: [],
      logsCategory: []
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
    filters.role,
    filters.actionType,
    filters.logsCategory,
    range.start,
    range.end
  ])

  /* ---------- build query params ----------
     Note: hook expects `practice_id` as a string (join multi-select into comma string)
  */
  const queryParams = useMemo(
    () => ({
      search: filters.value || undefined,
      actor_type:
        filters.role && filters.role.length ? filters.role : undefined,
      event_feature:
        filters.logsCategory && filters.logsCategory.length
          ? filters.logsCategory
          : undefined,
      event_type:
        filters.actionType && filters.actionType.length
          ? filters.actionType
          : undefined,
      start_date: range.start,
      end_date: range.end,
      page,
      page_size: pageSize,
      ordering: sortModel?.[0]?.field,
      sortOrder: sortModel?.[0]?.sort ?? undefined,
      is_paginated: true
    }),
    [filters, range, page, pageSize, sortModel]
  )

  /* ---------- data ---------- */
  const { data, isPending } = useFetchAuditLogsList(queryParams, {
    enabled: !!accessToken
  })

  /* =======================
     Render
  ======================= */

  return (
    <Box className={styles.contentRoot}>
      <Box p={'0px 16px 16px 16px'}>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'stretch',
            gap: 2
          }}
        >
          {/* Search */}
          <Controller
            name='value'
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label='Search by user name'
                sx={FIELD_FLEX_SX}
                error={!!errors.value}
              />
            )}
          />

          {/* Role */}
          <FormControl sx={FIELD_FLEX_SX}>
            <InputLabel id='role-label'>Role</InputLabel>
            <Controller
              name='role'
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
                    input={<OutlinedInput label='Role' />}
                    renderValue={() =>
                      selected.length
                        ? joinLabels(USER_ROLES as any, selected)
                        : 'All'
                    }
                  >
                    <MenuItem value=''>
                      <em>All</em>
                    </MenuItem>
                    {USER_ROLES.map((o) => (
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

          {/* Logs category */}
          <FormControl sx={FIELD_FLEX_SX}>
            <InputLabel id='logs-category-label'>Logs category</InputLabel>
            <Controller
              name='logsCategory'
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
                    input={<OutlinedInput label='Logs category' />}
                    renderValue={() =>
                      selected.length
                        ? joinLabels(LOGS_CATEGORY_OPTIONS, selected)
                        : 'All'
                    }
                  >
                    <MenuItem value=''>
                      <em>All</em>
                    </MenuItem>
                    {LOGS_CATEGORY_OPTIONS.map((o) => (
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

          {/* Action type */}
          <FormControl sx={FIELD_FLEX_SX}>
            <InputLabel id='action-type-label'>Action type</InputLabel>
            <Controller
              name='actionType'
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
                    input={<OutlinedInput label='Action type' />}
                    renderValue={() =>
                      selected.length
                        ? joinLabels(ACTION_TYPE_OPTIONS, selected)
                        : 'All'
                    }
                  >
                    <MenuItem value=''>
                      <em>All</em>
                    </MenuItem>
                    {ACTION_TYPE_OPTIONS.map((o) => (
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
              // placeholder='DD/MM/YYYY - DD/MM/YYYY'
            />
          </Box>
          <Button
            startIcon={<CloseIcon />}
            variant='text'
            onClick={onClearFilters}
          >
            Clear Filters
          </Button>
        </Box>
      </Box>

      {/* Table */}
      <AuditLogsTable
        data={data}
        loading={isPending}
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

export default AuditLogsContent
