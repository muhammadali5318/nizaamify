/* eslint-disable no-console */
// src/modules/team-members/TeamMembers.tsx
import { useMemo, useState, useEffect } from 'react'
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  TablePagination
} from '@mui/material'
import { DataGrid, GridSortModel } from '@mui/x-data-grid'
import TeamManagementContentWrapper from '../components/TeamManagementContentWrapper'
import styles from './teamMembers.module.scss'
import { teamMembersSx } from '../team-management-config'
import { JSX } from 'react/jsx-runtime'
import { useTeamMembersColumns } from '../hooks/useTeamMembersColumns'
import {
  MemberRow,
  generateDummyData,
  clampPage,
  MenuProps,
  ROLE_OPTIONS,
  STATUS_OPTIONS
} from '../team-members-config'
import { NoResultsBox } from './components/TeamMembers'

export default function TeamMembers(): JSX.Element {
  // filter state
  const [searchKey, setSearchKey] = useState<string>('')
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])

  // data + selection + sorting + pagination
  const [allRows] = useState<MemberRow[]>(() => generateDummyData(50))
  const [loading, setLoading] = useState<boolean>(false)

  // pagination
  const [page, setPage] = useState<number>(0)
  const [pageSize, setPageSize] = useState<number>(10)
  const [totalRecords, setTotalRecords] = useState<number>(allRows.length)

  // sort model
  const [sortModel, setSortModel] = useState<GridSortModel>([])

  // filtering
  const filtered = useMemo(() => {
    const q = searchKey.trim().toLowerCase()
    return allRows.filter((r) => {
      if (q) {
        const match =
          r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)
        if (!match) return false
      }
      if (selectedRoles.length > 0 && !selectedRoles.includes(r.role))
        return false
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(r.status))
        return false
      return true
    })
  }, [allRows, searchKey, selectedRoles, selectedStatuses])

  // sorting (client-side mimic)
  const sorted = useMemo(() => {
    if (!sortModel || sortModel.length === 0) return filtered
    const model = sortModel[0]
    const sortedRows = [...filtered].sort((a: any, b: any) => {
      const field = model.field as keyof MemberRow
      const dir = model.sort === 'asc' ? 1 : -1
      if (a[field] == null) return 1 * dir
      if (b[field] == null) return -1 * dir
      return a[field] > b[field] ? 1 * dir : -1 * dir
    })
    return sortedRows
  }, [filtered, sortModel])

  // page calculations
  const pageCount = Math.ceil(sorted.length / pageSize) || 1
  const effectivePage = clampPage(page, pageCount)
  const visibleRows = sorted.slice(
    effectivePage * pageSize,
    effectivePage * pageSize + pageSize
  )

  useEffect(() => {
    setTotalRecords(sorted.length)
  }, [sorted])

  const fetchSortedData = (model: GridSortModel) => {
    setLoading(true)
    setTimeout(() => {
      setSortModel(model)
      setLoading(false)
    }, 300)
  }

  const handleClearFilters = () => {
    setSearchKey('')
    setSelectedRoles([])
    setSelectedStatuses([])
    setPage(0)
  }

  const getRowClassName = (params: any) => {
    return params.row.status === 'Disabled' ? styles.rowDisabled : ''
  }

  // handlers for actions (pass into hook)
  const handlers = {
    onView: (id: string) => console.log('view', id),
    onInvite: (id: string) => console.log('invite', id),
    onSwap: (id: string) => console.log('swap', id),
    onDelete: (id: string) => console.log('delete', id)
  }

  const columns = useTeamMembersColumns(handlers)

  // rows passed into DataGrid (flat)
  const practiceList = visibleRows.map((r) => ({ ...r }))

  const noRowsLabel = (
    <NoResultsBox
      loading={loading}
      searchKey={searchKey}
      onClear={handleClearFilters}
    />
  )

  return (
    <TeamManagementContentWrapper
      imageSrc='/assets/team-members-list.svg'
      imageAlt='team-members-list'
      title='Team members'
      subtitle='Manage your practice team members and their access'
    >
      {/* Filters */}
      <Box className={styles.filterContainer}>
        <Box className={styles.filterBody}>
          <TextField
            label='Search'
            variant='outlined'
            value={searchKey}
            onChange={(e) => {
              setSearchKey(e.target.value)
              setPage(0)
            }}
            placeholder='Search by name, email...'
            sx={{ minWidth: 300, flex: '1 1 300px' }}
          />

          <FormControl sx={{ minWidth: 180, flex: '0 0 180px' }}>
            <InputLabel id='roles-select-label'>Role</InputLabel>
            <Select
              labelId='roles-select-label'
              multiple
              value={selectedRoles}
              onChange={(e) => {
                const value = e.target.value
                setSelectedRoles(
                  typeof value === 'string' ? value.split(',') : value
                )
                setPage(0)
              }}
              renderValue={(selected) => (selected as string[]).join(', ')}
              label='Role'
              MenuProps={MenuProps}
            >
              {ROLE_OPTIONS.map((role) => (
                <MenuItem key={role} value={role}>
                  <Checkbox checked={selectedRoles.indexOf(role) > -1} />
                  <ListItemText primary={role} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 180, flex: '0 0 180px' }}>
            <InputLabel id='status-select-label'>Status</InputLabel>
            <Select
              labelId='status-select-label'
              multiple
              value={selectedStatuses}
              onChange={(e) => {
                const value = e.target.value
                setSelectedStatuses(
                  typeof value === 'string' ? value.split(',') : value
                )
                setPage(0)
              }}
              renderValue={(selected) => (selected as string[]).join(', ')}
              label='Status'
              MenuProps={MenuProps}
            >
              {STATUS_OPTIONS.map((status) => (
                <MenuItem key={status} value={status}>
                  <Checkbox checked={selectedStatuses.indexOf(status) > -1} />
                  <ListItemText primary={status} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>

      {/* DataGrid */}
      <Box sx={{ width: '100%', mt: 3 }}>
        <DataGrid
          rows={practiceList}
          columns={columns}
          getRowClassName={getRowClassName}
          pageSizeOptions={[5, 10, 25, { value: -1, label: 'All' }]}
          disableColumnMenu
          disableColumnResize
          rowHeight={56}
          hideFooter={true}
          getRowId={(row) => row.id}
          sortingMode='server'
          localeText={{
            noRowsLabel
          }}
          onSortModelChange={(model: GridSortModel) => {
            // trigger a "server" fetch (we simulate it)
            fetchSortedData(model)
          }}
          sortModel={sortModel}
          sx={{ ...teamMembersSx }}
        />

        <TablePagination
          className='pagination-container'
          rowsPerPageOptions={[5, 10, 25, 50]}
          component='div'
          count={totalRecords}
          rowsPerPage={pageSize}
          page={effectivePage}
          onPageChange={(_, newPage) => setPage(newPage)}
          onRowsPerPageChange={(event) => {
            setPageSize(parseInt(event.target.value, 10))
            setPage(0)
          }}
        />
      </Box>
    </TeamManagementContentWrapper>
  )
}
