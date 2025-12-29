import { Box, TablePagination } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import { useMemo } from 'react'
import { useFetchSortedPaginatedData } from 'src/hooks/useFetchSortedData.'
import { useAuditLogsColumns } from '../../hooks/useAuditLogsColumns'
import { teamMembersSx } from 'src/pages/team-management/team-management-config'
import { NoResultsBox } from 'src/pages/team-management/team-members/components/TeamMembers'

const AuditLogsTable = () => {
  const { sortModel, page, pageSize, setPage, setPageSize, handleSortChange } =
    useFetchSortedPaginatedData()

  //   const getRowClassName = (params: any) =>
  //     params.row.status === 'Disabled' ? styles.rowDisabled : ''
  const handlers = {}
  const columns = useAuditLogsColumns(handlers)

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
            rows={[]}
            columns={columns}
            // getRowClassName={getRowClassName}
            getRowId={(row) => row.id}
            pageSizeOptions={[5, 10, 25, { value: -1, label: 'All' }]}
            disableColumnMenu
            disableColumnResize
            rowHeight={56}
            hideFooter
            sortingMode='server'
            sortModel={sortModel}
            loading={false}
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
                  loading={false}
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
        count={0}
        rowsPerPage={pageSize}
        page={page}
        onPageChange={(_, newPage) => setPage(newPage)}
        onRowsPerPageChange={(event) => {
          setPageSize(parseInt(event.target.value, 10))
          setPage(0)
        }}
        showFirstButton
        showLastButton
      />
    </Box>
  )
}

export default AuditLogsTable
