import React, { useCallback, useMemo, useState } from 'react'
import {
  Box,
  Typography,
  TablePagination,
  Checkbox,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  TextField
} from '@mui/material'
import { DataGrid, GridSortModel } from '@mui/x-data-grid'
import PageHeader from 'src/components/page-header'
import DateRangeSelector, { RangeISO } from 'src/components/date-range-selector'
import AddPaymentDateModal from '../components/AddPaymentDateModal'
import DocumentDetailsModal from '../components/document-details-modal/DocumentDetailsModal'
import { teamMembersSx } from 'src/pages/team-management/team-management-config'
import { usePendingDocsColumns } from '../hooks/usePendingDocsColumns'
import { useFetchSortedPaginatedData } from 'src/hooks/useFetchSortedData.'
import styles from './PendingDocuments.module.scss'
import dayjs from 'dayjs'

// --- Options (keep in separate file if desired) ---
const CATEGORY_OPTIONS = [
  { value: 'contracts', label: 'Contracts' },
  { value: 'invoices', label: 'Invoices' },
  { value: 'licenses', label: 'Licenses' },
  { value: 'policies', label: 'Policies' },
  { value: 'forms', label: 'Forms' }
]

const UPLOADED_BY_OPTIONS = [
  { value: 'dr_sarah_johnson', label: 'Dr. Sarah Johnson' },
  { value: 'admin_team', label: 'Admin Team' },
  { value: 'john_smith', label: 'John Smith' },
  { value: 'jane_doe', label: 'Jane Doe' },
  { value: 'practice_manager', label: 'Practice Manager' }
]

// --- Types ---
interface PendingDocumentsProps {
  title: string
  description: string
  icon: string
  isPendingDocments: boolean
}

interface FilterState {
  searchKey: string
  categories: string[]
  uploadedBy: string[]
  dateRange: RangeISO
}

// ------------------
// FilterBar Component
// ------------------
export const FilterBar: React.FC<{
  value: FilterState
  onChange: (next: Partial<FilterState>) => void
}> = ({ value, onChange }) => {
  const { searchKey, categories, uploadedBy, dateRange } = value

  return (
    <Box
      className={styles.filterContainer}
      display='flex'
      gap={2}
      flexWrap='wrap'
    >
      <TextField
        label='Search'
        variant='outlined'
        value={searchKey}
        onChange={(e) => onChange({ searchKey: e.target.value })}
        placeholder='Search by name'
      />

      <FormControl>
        <InputLabel id='categories-select-label'>Categories</InputLabel>
        <Select
          labelId='categories-select-label'
          multiple
          value={categories}
          onChange={(e) => {
            const v = e.target.value
            onChange({ categories: typeof v === 'string' ? v.split(',') : v })
          }}
          renderValue={(selected) =>
            (selected as string[])
              .map(
                (val) =>
                  CATEGORY_OPTIONS.find((o) => o.value === val)?.label ?? val
              )
              .join(', ')
          }
          label='Categories'
          MenuProps={{}}
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              <Checkbox checked={categories.indexOf(opt.value) > -1} />
              <ListItemText primary={opt.label} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl>
        <InputLabel id='uploaded-by-select-label'>Uploaded By</InputLabel>
        <Select
          labelId='uploaded-by-select-label'
          multiple
          value={uploadedBy}
          onChange={(e) => {
            const v = e.target.value
            onChange({ uploadedBy: typeof v === 'string' ? v.split(',') : v })
          }}
          renderValue={(selected) =>
            (selected as string[])
              .map(
                (val) =>
                  UPLOADED_BY_OPTIONS.find((o) => o.value === val)?.label ?? val
              )
              .join(', ')
          }
          label='Uploaded By'
          MenuProps={{}}
        >
          {UPLOADED_BY_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              <Checkbox checked={uploadedBy.indexOf(opt.value) > -1} />
              <ListItemText primary={opt.label} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <DateRangeSelector
        value={dateRange}
        onChange={(next) => onChange({ dateRange: next })}
      />
    </Box>
  )
}

// ------------------
// DocumentsTable Component
// ------------------
export const DocumentsTable: React.FC<{
  rows: any[]
  columns: any[]
  getRowClassName?: (params: any) => string
  page: number
  pageSize: number
  setPage: (p: number) => void
  setPageSize: (s: number) => void
  sortModel: GridSortModel
  onSortModelChange: (model: GridSortModel) => void
  loading?: boolean
}> = ({
  rows,
  columns,
  getRowClassName,
  page,
  pageSize,
  setPage,
  setPageSize,
  sortModel,
  onSortModelChange,
  loading = false
}) => {
  const totalMinWidth = useMemo(() => {
    return columns.reduce((sum, col) => {
      const colMin = (col as any).minWidth ?? (col as any).width ?? 120
      return sum + Number(colMin)
    }, 0)
  }, [columns])

  return (
    <Box sx={{ width: '100%', maxWidth: '100vw', boxSizing: 'border-box' }}>
      {rows.length === 0 ? (
        <Box
          height={336}
          display='flex'
          alignItems='center'
          justifyContent='center'
          flexDirection='column'
        >
          <img
            src='/assets/no-invite-icon.svg'
            alt='No invitations found'
            style={{ maxHeight: 336, objectFit: 'contain' }}
          />
          <Typography variant='body1' color='text.primary' fontWeight={700}>
            No Pending Document
          </Typography>
        </Box>
      ) : (
        <>
          <Box
            sx={{
              width: '100%',
              maxWidth: '90vw',
              overflowX: 'auto',
              boxSizing: 'border-box'
            }}
          >
            <Box
              sx={{
                minWidth: `${totalMinWidth}px`,
                width: '100%',
                boxSizing: 'border-box'
              }}
            >
              <DataGrid
                rows={rows}
                columns={columns}
                getRowClassName={getRowClassName}
                getRowId={(row) => row.id}
                pageSizeOptions={[5, 10, 25, { value: -1, label: 'All' }]}
                disableColumnMenu
                disableColumnResize
                rowHeight={56}
                hideFooter
                sortingMode='server'
                sortModel={sortModel}
                onSortModelChange={onSortModelChange}
                loading={loading}
                sx={{
                  ...teamMembersSx,
                  width: '100%',
                  minWidth: `${totalMinWidth}px`,
                  boxSizing: 'border-box',
                  '& .MuiDataGrid-virtualScroller': { overflowX: 'hidden' },
                  '& .MuiDataGrid-cell': { py: 1 }
                }}
              />
            </Box>
          </Box>

          <TablePagination
            className='pagination-container'
            rowsPerPageOptions={[5, 10, 25, 50]}
            component='div'
            count={rows.length}
            rowsPerPage={pageSize}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            onRowsPerPageChange={(event) => {
              const newSize = parseInt(event.target.value, 10)
              setPageSize(newSize)
              setPage(0)
            }}
            showFirstButton
            showLastButton
          />
        </>
      )}
    </Box>
  )
}

// ------------------
// Parent: PendingDocuments (composes the two above)
// ------------------
const PendingDocuments: React.FC<PendingDocumentsProps> = ({
  title,
  description,
  icon,
  isPendingDocments
}) => {
  // external hook: paging & sorting
  const { sortModel, page, pageSize, setPage, setPageSize, handleSortChange } =
    useFetchSortedPaginatedData()

  // Local UI state
  const [addDateModalOpen, setAddDateModalOpen] = useState(false)
  const [addDateLoading, setAddDateLoading] = useState(false)

  const [downloadModalOpen, setDownloadModalOpen] = useState(false)
  const [downloadLoading, setDownloadLoading] = useState(false)

  // Filters state -- collapse into a single object for easier passing
  const [filters, setFilters] = useState<FilterState>({
    searchKey: '',
    categories: [],
    uploadedBy: [],
    dateRange: { start: null, end: null }
  })

  const handleFilterChange = useCallback(
    (next: Partial<FilterState>) => {
      setFilters((prev) => ({ ...prev, ...next }))
      setPage(0)
    },
    [setPage]
  )

  // handlers used by columns
  const onView = useCallback(() => setAddDateModalOpen(true), [])
  const onViewDownload = useCallback(() => setDownloadModalOpen(true), [])
  const handlers = useMemo(
    () => ({ onView, onViewDownload }),
    [onView, onViewDownload]
  )

  const columns = usePendingDocsColumns(handlers, isPendingDocments)

  // --- Dummy rows for example ---
  const rows = [
    {
      id: 1,
      'Document-name': 'NHS Contract 2025',
      type: 'Contract',
      Subtype: 'Annual Renewal',
      'Document date': '2025-10-12',
      'Uploaded-by': 'Dr. Sarah Johnson'
    },
    {
      id: 2,
      'Document-name': 'Invoice Q3',
      type: 'Invoice',
      Subtype: 'Finance',
      'Document date': '2025-09-28',
      'Uploaded-by': 'Admin Team'
    },
    {
      id: 3,
      'Document-name': 'Staff License',
      type: 'License',
      Subtype: 'HR',
      'Document date': '2025-10-05',
      'Uploaded-by': 'John Smith'
    }
  ]

  const getRowClassName = (params: any) =>
    params.row.status === 'Disabled' ? 'rowDisabled' : ''

  // Download handler
  const handleDocumentDownload = useCallback(async () => {
    try {
      setDownloadLoading(true)
      // TODO: call api, stream file, show toast, etc.
    } catch {
      setDownloadLoading(false)
    } finally {
      setDownloadLoading(false)
    }
  }, [])

  // Add-date (view) handler
  const handleAddDate = useCallback(async (data: { date: dayjs.Dayjs }) => {
    // eslint-disable-next-line no-console
    console.log(data)
    try {
      setAddDateLoading(true)
    } catch {
      setAddDateLoading(true)
    } finally {
      setAddDateLoading(false)
    }
  }, [])

  return (
    <Box className={styles.moduleRoot}>
      <Box p={2}>
        <PageHeader
          title={title}
          description={description}
          logo={icon}
          isDividerVisible={false}
        />
      </Box>

      <FilterBar value={filters} onChange={handleFilterChange} />

      <DocumentsTable
        rows={rows}
        columns={columns}
        getRowClassName={getRowClassName}
        page={page}
        pageSize={pageSize}
        setPage={setPage}
        setPageSize={setPageSize}
        sortModel={sortModel}
        onSortModelChange={handleSortChange}
        loading={false}
      />

      {/* Modals live in parent - they are UI concerns of the page rather than table internals */}
      <AddPaymentDateModal
        open={addDateModalOpen}
        onClose={() => setAddDateModalOpen(false)}
        onInvite={handleAddDate}
        loading={addDateLoading}
      />

      <DocumentDetailsModal
        open={downloadModalOpen}
        onClose={() => {
          setDownloadModalOpen(false)
        }}
        onDownload={handleDocumentDownload}
        loading={downloadLoading}
      />
    </Box>
  )
}

export default PendingDocuments
