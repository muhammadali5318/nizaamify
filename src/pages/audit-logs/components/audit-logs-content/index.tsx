import React from 'react'
import {
  Box,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  TextField
} from '@mui/material'
import { Controller, useForm } from 'react-hook-form'
import styles from '../../auditLogs.module.scss'
import { USER_ROLES } from 'src/const'
import AuditLogsTable from '../audit-logs-table'

type TechLogsFilters = {
  value?: string
  practice?: string
  role?: string
  status?: string
  actionType?: string
  logsCategory?: string
}

type Props = {
  onApplyFilters?: (filters: TechLogsFilters) => void
  defaultValues?: Partial<TechLogsFilters>
}

const STATUS_OPTIONS = [
  { value: 'success', label: 'Success' },
  { value: 'failed', label: 'Failed' },
  { value: 'pending', label: 'Pending' },
  { value: 'in-progress', label: 'In Progress' }
]

const ACTION_TYPE_OPTIONS = [
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'download', label: 'Download' },
  { value: 'view', label: 'View' }
]

const LOGS_CATEGORY_OPTIONS = [
  { value: 'auth', label: 'Authentication' },
  { value: 'system', label: 'System Logs' },
  { value: 'integration', label: 'Integration Logs' },
  { value: 'subscription', label: 'Subscription Events' },
  { value: 'user', label: 'User Activity' }
]

const AuditLogsContent: React.FC<Props> = ({
  onApplyFilters,
  defaultValues
}) => {
  const {
    control,
    handleSubmit,
    formState: { errors }
  } = useForm<TechLogsFilters>({
    defaultValues: {
      value: '',
      practice: '',
      role: '',
      status: '',
      actionType: '',
      logsCategory: '',
      ...defaultValues
    }
  })

  const applyFilters = (data: TechLogsFilters) => {
    if (onApplyFilters) onApplyFilters(data)
  }

  return (
    <Box className={styles.contentRoot}>
      <Box
        p={2}
        pt={0}
        component='form'
        onSubmit={handleSubmit(applyFilters)}
        noValidate
        className={'filterContainer'}
      >
        <Controller
          name='value'
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label='Search by user name'
              variant='outlined'
              error={!!errors.value}
              helperText={errors.value?.message as React.ReactNode}
            />
          )}
        />

        <FormControl error={!!errors.role}>
          <InputLabel id='filter-role-label'>Role</InputLabel>
          <Controller
            name='role'
            control={control}
            render={({ field }) => (
              <Select {...field} labelId='filter-role-label' label='Role'>
                <MenuItem value=''>
                  <em>All</em>
                </MenuItem>
                {USER_ROLES.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </Select>
            )}
          />
          <FormHelperText>
            {errors.role?.message as React.ReactNode}
          </FormHelperText>
        </FormControl>

        <FormControl error={!!errors.status}>
          <InputLabel id='filter-status-label'>Status</InputLabel>
          <Controller
            name='status'
            control={control}
            render={({ field }) => (
              <Select {...field} labelId='filter-status-label' label='Status'>
                <MenuItem value=''>
                  <em>All</em>
                </MenuItem>
                {STATUS_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </Select>
            )}
          />
          <FormHelperText>
            {errors.status?.message as React.ReactNode}
          </FormHelperText>
        </FormControl>

        <FormControl error={!!errors.actionType}>
          <InputLabel id='filter-actiontype-label'>Action type</InputLabel>
          <Controller
            name='actionType'
            control={control}
            render={({ field }) => (
              <Select
                {...field}
                labelId='filter-actiontype-label'
                label='Action type'
              >
                <MenuItem value=''>
                  <em>All</em>
                </MenuItem>
                {ACTION_TYPE_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </Select>
            )}
          />
          <FormHelperText>
            {errors.actionType?.message as React.ReactNode}
          </FormHelperText>
        </FormControl>

        <FormControl error={!!errors.logsCategory}>
          <InputLabel id='filter-logscategory-label'>Logs category</InputLabel>
          <Controller
            name='logsCategory'
            control={control}
            render={({ field }) => (
              <Select
                {...field}
                labelId='filter-logscategory-label'
                label='Logs category'
              >
                <MenuItem value=''>
                  <em>All</em>
                </MenuItem>
                {LOGS_CATEGORY_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </Select>
            )}
          />
          <FormHelperText>
            {errors.logsCategory?.message as React.ReactNode}
          </FormHelperText>
        </FormControl>
        <Box></Box>
      </Box>

      <AuditLogsTable />
    </Box>
  )
}

export default AuditLogsContent
