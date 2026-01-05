import { Box, TablePagination } from '@mui/material'
import { DataGrid, GridSortModel } from '@mui/x-data-grid'
import { useMemo } from 'react'
import { NoResultsBox } from 'src/pages/team-management/team-members/components/TeamMembers'
import { teamMembersSx } from 'src/pages/team-management/team-management-config'
import { useAuditLogsColumns } from '../../hooks/useAuditLogsColumns'

export interface AuditLog {
  id: number
  event_id: string
  event_action: string
  event_type: string
  event_description: string
  event_feature: string
  event_metadata: Record<string, any>
  actor_type: string
  actor_description: string
  actor_id: string
  actor_email: string
  target_user_type: string | null
  target_user_description: string | null
  target_user_id: string | null
  target_user_email: string | null
  practice_id: string
  practice_name: string
  platform: string
  created_at: string
}

export interface AuditLogsResponse {
  count: number
  next: string | null
  previous: string | null
  results: AuditLog[]
}

interface AuditLogsTableProps {
  data: AuditLogsResponse | null
  loading?: boolean
  // sorting + pagination props coming from useFetchSortedPaginatedData
  sortModel?: GridSortModel
  handleSortChange?: (model: GridSortModel) => void
  page?: number
  pageSize?: number
  setPage?: (p: number) => void
  setPageSize?: (s: number) => void
}

const AuditLogsTable = ({
  data,
  loading = false,
  sortModel = [],
  handleSortChange = () => {},
  page = 0,
  pageSize = 10,
  setPage = () => {},
  setPageSize = () => {}
}: AuditLogsTableProps) => {
  const columns = useAuditLogsColumns()

  // Compute total minWidth for columns to prevent shrinking
  const totalMinWidth = useMemo(() => {
    return columns.reduce((sum, col) => {
      const colMin = (col as any).minWidth ?? (col as any).width ?? 120
      return sum + Number(colMin)
    }, 0)
  }, [columns])

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: '100vw',
        boxSizing: 'border-box'
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: '90vw',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
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
            rows={data?.results ?? []}
            columns={columns}
            getRowId={(row) => row.id}
            pageSizeOptions={[5, 10, 25, { value: -1, label: 'All' }]}
            disableColumnMenu
            disableColumnResize
            rowHeight={56}
            hideFooter
            sortingMode='server'
            sortModel={sortModel}
            loading={loading}
            onSortModelChange={handleSortChange}
            sx={{
              ...teamMembersSx,
              width: '100%',
              minWidth: `${totalMinWidth}px`,
              boxSizing: 'border-box',
              '& .MuiDataGrid-virtualScroller': {
                overflowX: 'hidden'
              },
              '& .MuiDataGrid-cell': {
                py: 1
              }
            }}
            slots={{
              noRowsOverlay: () => (
                <NoResultsBox
                  loading={loading}
                  searchKey={''}
                  // eslint-disable-next-line no-console
                  onClear={() => console.log('cleared')}
                />
              )
            }}
          />
        </Box>
      </Box>

      <TablePagination
        className='pagination-container'
        rowsPerPageOptions={[5, 10, 25, 50]}
        component='div'
        count={data?.count ?? 0}
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
    </Box>
  )
}

export default AuditLogsTable
