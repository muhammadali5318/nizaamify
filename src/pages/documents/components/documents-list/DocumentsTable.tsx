// file: DocumentsTable.tsx (updated)
import { Box, TablePagination } from '@mui/material' // added Button
import { GridSortModel, DataGrid } from '@mui/x-data-grid'
import { useMemo, useCallback } from 'react' // useCallback used below
import { teamMembersSx } from 'src/pages/team-management/team-management-config'
import { NoResultsBox } from 'src/pages/team-management/team-members/components/TeamMembers'

const DocumentsTable: React.FC<{
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
  totalCount?: number
  onClearFilters?: () => void
  searchKey?: string
  isAnyFilterApplied?: boolean
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
  loading = false,
  totalCount = 0,
  onClearFilters,
  searchKey = '',
  isAnyFilterApplied
}) => {
  const totalMinWidth = useMemo(() => {
    return columns.reduce((sum, col) => {
      const colMin = (col as any).minWidth ?? (col as any).width ?? 120
      return sum + Number(colMin)
    }, 0)
  }, [columns])

  // wrapper that guarantees a () => void for NoResultsBox
  const handleClear = useCallback(() => {
    if (onClearFilters) onClearFilters()
  }, [onClearFilters])

  return (
    <Box sx={{ width: '100%', maxWidth: '100vw', boxSizing: 'border-box' }}>
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
              slots={{
                noRowsOverlay: () => (
                  <NoResultsBox
                    loading={loading}
                    searchKey={searchKey}
                    onClear={handleClear}
                    isAnyFilterApplied={isAnyFilterApplied}
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
          count={totalCount}
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
    </Box>
  )
}

export default DocumentsTable
