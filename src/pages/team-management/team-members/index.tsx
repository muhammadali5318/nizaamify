import React, { useMemo, useState, useEffect, JSX } from 'react'
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  Button,
  Avatar,
  Typography,
  IconButton,
  CircularProgress,
  Tooltip,
  TablePagination
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  DataGrid,
  GridColDef,
  GridCellParams,
  GridSortModel
} from '@mui/x-data-grid'
import TeamManagementContentWrapper from '../components/TeamManagementContentWrapper'
import styles from './teamMembers.module.scss'

// --- options ---
const ROLE_OPTIONS = [
  'Admin',
  'Manager',
  'Dentist',
  'Hygienist',
  'Reception',
  'Finance'
]
const STATUS_OPTIONS = ['Active', 'Pending', 'Invited', 'Disabled']

// DataGrid menu props (keeps dropdown reasonably sized)
const ITEM_HEIGHT = 48
const ITEM_PADDING_TOP = 8
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 260
    }
  }
}

// --- types ---
type MemberRow = {
  id: string
  name: string
  email: string
  role: string
  status: string
}

// --- helpers ---
const generateDummyData = (count = 50): MemberRow[] => {
  const names = [
    'Ali Khan',
    'Sara Ahmed',
    'Hassan Raza',
    'Ayesha Noor',
    'Bilal Malik',
    'Fatima Iqbal',
    'Usman Tariq',
    'Zara Ali',
    'Omar Siddiqui',
    'Maryam Khan'
  ]

  return Array.from({ length: count }).map((_, i) => {
    const base = names[i % names.length]
    const name = `${base} ${i + 1}`
    return {
      id: `m-${i + 1}`,
      name,
      email: `${base.toLowerCase().replace(/\s+/g, '.')}.${i}@example.com`,
      role: ROLE_OPTIONS[i % ROLE_OPTIONS.length],
      status: STATUS_OPTIONS[i % STATUS_OPTIONS.length]
    }
  })
}

// Simple loader used inside the grid locale text
const CustomLoader: React.FC<{ backgroundColor?: string }> = ({
  backgroundColor
}) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      py: 4
    }}
  >
    <CircularProgress />
  </Box>
)

// --- component ---
export default function TeamMembers(): JSX.Element {
  // filter state
  const [searchKey, setSearchKey] = useState<string>('')
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])

  // data + selection + sorting + pagination
  const [allRows] = useState<MemberRow[]>(() => generateDummyData(50))
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
  const [loading, setLoading] = useState<boolean>(false)

  // DataGrid pagination controlled by external TablePagination
  const [page, setPage] = useState<number>(0)
  const [pageSize, setPageSize] = useState<number>(10)
  const [totalRecords, setTotalRecords] = useState<number>(allRows.length)

  // sort model (server mode style in example)
  const [sortModel, setSortModel] = useState<GridSortModel>([])

  // ------------------
  // Filtering & sorting (client-side for dummy)
  // ------------------
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

  // apply sorting (client-side mimic for now)
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

  // current page rows for DataGrid
  const pageCount = Math.ceil(sorted.length / pageSize) || 1
  const effectivePage = Math.min(page, Math.max(0, pageCount - 1))
  const visibleRows = sorted.slice(
    effectivePage * pageSize,
    effectivePage * pageSize + pageSize
  )

  useEffect(() => {
    // keep totalRecords in sync AND remove selection for rows that are no longer in the filtered dataset
    setTotalRecords(sorted.length)
    setSelectedMemberIds((prev) =>
      prev.filter((id) => sorted.some((r) => r.id === id))
    )
  }, [sorted])

  // fake server fetch when sorting changes (shows loader briefly and keeps client-side behavior)
  const fetchSortedData = (model: GridSortModel) => {
    setLoading(true)
    // simulate delay
    setTimeout(() => {
      setSortModel(model)
      setLoading(false)
    }, 300)
  }

  // clear filters
  const handleClearFilters = () => {
    setSearchKey('')
    setSelectedRoles([])
    setSelectedStatuses([])
    setPage(0)
  }

  // selection helpers
  const toggleId = (id: string, checked: boolean) => {
    setSelectedMemberIds((prev) =>
      checked
        ? Array.from(new Set([...prev, id]))
        : prev.filter((p) => p !== id)
    )
  }

  // select / deselect all filtered rows
  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      // select all filtered (sorted) row ids (so respects filters)
      setSelectedMemberIds(sorted.map((r) => r.id))
    } else {
      setSelectedMemberIds([])
    }
  }

  // row class name example (theme-specific styling can be added in SCSS)
  const getRowClassName = (params: any) => {
    return params.row.status === 'Disabled' ? styles.rowDisabled : ''
  }

  const ImgIcon = ({ src, alt }: { src: string; alt?: string }) => (
    <Box
      component='img'
      src={src}
      alt={alt || ''}
      sx={{ width: 18, height: 18, display: 'block' }}
    />
  )

  // --- DataGrid columns ---
  const columns: GridColDef[] = [
    {
      field: 'select',
      headerName: '',
      sortable: false,
      filterable: false,
      renderHeader: () => {
        const total = sorted.length
        const selectedCount = selectedMemberIds.length
        const checked = total > 0 && selectedCount === total
        const indeterminate = selectedCount > 0 && selectedCount < total

        return (
          <Checkbox
            size='small'
            checked={checked}
            indeterminate={indeterminate}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              const checked = e.target.checked
              toggleSelectAll(checked)
            }}
            sx={{ padding: 1 }}
            disabled={total === 0}
            inputProps={{ 'aria-label': 'select all members' }}
          />
        )
      },
      renderCell: (params) => {
        const checked = selectedMemberIds.includes(params.row.id)
        return (
          <Checkbox
            size='small'
            checked={checked}
            onChange={(e) => toggleId(params.row.id, e.target.checked)}
            sx={{ padding: 1 }}
          />
        )
      },
      width: 64
    },
    {
      field: 'member',
      headerName: 'Members',
      flex: 1,
      sortable: false,
      renderCell: (params: GridCellParams) => (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {/* avatar commented out — re-enable if needed */}
          {/* <Avatar sx={{ width: 36, height: 36 }}>{String(params.row.name || ' ? ').split(' ').map((n: string) => n[0]).slice(0,2).join('')}</Avatar> */}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <Typography variant='body2'>{params.row.name}</Typography>
            <Typography
              variant='caption'
              color='text.secondary'
              sx={{ lineHeight: 1 }}
            >
              {params.row.email}
            </Typography>
          </Box>
        </Box>
      )
    },
    {
      field: 'role',
      headerName: 'Role',
      flex: 1,
      sortable: true,
      renderCell: (params: GridCellParams) => (
        <Typography variant='body2'>{params.row.role}</Typography>
      )
    },
    {
      field: 'status',
      headerName: 'Status',
      flex: 1,
      sortable: true,
      renderCell: (params: GridCellParams) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant='body2'>{params.row.status}</Typography>
        </Box>
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      flex: 1,
      sortable: false,
      renderCell: (params: GridCellParams) => (
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            justifyContent: 'flex-start',
            width: '100%',
            alignItems: 'center'
          }}
        >
          <Tooltip title='View'>
            <IconButton
              size='small'
              onClick={() => console.log('view', params.row.id)}
              aria-label='view member'
            >
              <ImgIcon src='/assets/transparent-eye.svg' alt='view' />
            </IconButton>
          </Tooltip>

          <Tooltip title='Invite / Add'>
            <IconButton
              size='small'
              onClick={() => console.log('invite', params.row.id)}
              aria-label='invite member'
            >
              <ImgIcon src='/assets/person-add.svg' alt='invite' />
            </IconButton>
          </Tooltip>

          <Tooltip title='Swap'>
            <IconButton
              size='small'
              onClick={() => console.log('swap', params.row.id)}
              aria-label='swap member'
            >
              <ImgIcon src='/assets/swap-icon.svg' alt='swap' />
            </IconButton>
          </Tooltip>

          <Tooltip title='Delete'>
            <IconButton
              size='small'
              onClick={() => console.log('swap', params.row.id)}
              aria-label='flag icon'
            >
              <ImgIcon src='/assets/green-flag.svg' alt='flag icon' />
            </IconButton>
          </Tooltip>
        </Box>
      )
    }
  ]

  // rows passed into DataGrid (DataGrid expects flat objects)
  const practiceList = visibleRows.map((r) => ({ ...r }))

  // DataGrid locale text for no rows
  const noRowsLabel = loading ? (
    <Box className='no-result-found'>
      <CustomLoader />
    </Box>
  ) : practiceList.length === 0 && searchKey.length > 0 ? (
    <Box className='no-result-found'>
      <Box className='no-result-found-typography'>
        <Typography variant='body2'>
          Your search for '{searchKey}' did not match any results.
        </Typography>
        <Typography variant='body2'>
          Please try again with different keywords or adjust the filters.
        </Typography>
      </Box>
      <Button variant='outlined' onClick={handleClearFilters}>
        Clear All Filter
      </Button>
    </Box>
  ) : (
    <Box className='no-result-found'>
      <Box className='no-result-found-typography'>
        <Typography variant='body2'>
          Your search did not match any results.
        </Typography>
        <Typography variant='body2'>
          Please try again with different keywords or adjust the filters.
        </Typography>
      </Box>
      <Button variant='outlined' onClick={handleClearFilters}>
        Clear All Filter
      </Button>
    </Box>
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
            size='small'
          />

          <FormControl sx={{ minWidth: 180, flex: '0 0 180px' }} size='small'>
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

          <FormControl sx={{ minWidth: 180, flex: '0 0 180px' }} size='small'>
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

          <Box sx={{ marginLeft: 'auto' }}>
            <Button onClick={handleClearFilters} variant='outlined'>
              Clear
            </Button>
          </Box>
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
          sx={{
            border: 'none',
            '& .MuiDataGrid-columnSeparator': { display: 'none' },

            // vertically center headers & cells
            '& .MuiDataGrid-columnHeader, & .MuiDataGrid-cell': {
              display: 'flex',
              alignItems: 'center'
            },

            // remove visual header/cell right borders
            '& .MuiDataGrid-cell': { borderRight: 'none', outline: 'none' },

            // <-- new: header background and optional header cell styling
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: 'var(--grey-100, #F5F5F5)',
              // keep header text readable and aligned
              color: 'inherit',
              // if you want a little more header height:
              minHeight: 56
            },
            '& .MuiDataGrid-columnHeader': {
              borderRight: 'none',
              backgroundColor: 'transparent',
              borderBottom: '1px solid rgba(0,0,0,0.04)'
            },

            // optional: make header checkbox area match header background
            '& .MuiDataGrid-columnHeader .MuiCheckbox-root': {
              backgroundColor: 'transparent'
            }
          }}
        />

        {/* External pagination (keeps behaviour like example) */}
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
