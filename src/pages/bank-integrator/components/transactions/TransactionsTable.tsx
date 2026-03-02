import { useMemo, useState } from 'react'
import { Box, TablePagination } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import { NoResultsBox } from 'src/pages/team-management/team-members/components/TeamMembers'
import { teamMembersSx } from 'src/pages/team-management/team-management-config'
import { useTransactionsColumns } from '../../hooks/useTransactionsColumns'
import { useFetchSortedPaginatedData } from 'src/hooks/useFetchSortedData.'
import { dummyTransactions } from '../../bank-integrator-config'
import CategorisationModal from '../categorisation-modal'

const TransactionsTable = () => {
  const [categorisationOpen, setCategorisationOpen] = useState(false)
  const [selectedRow, setSelectedRow] = useState<any | null>(null)

  const handleOpenCategorise = (row: any) => {
    setSelectedRow(row)
    setCategorisationOpen(true)
  }

  const handleCloseCategorise = () => {
    setCategorisationOpen(false)
    setSelectedRow(null)
  }

  const handleSaveCategory = (category: string, row?: any) => {
    // TODO: call API or update local state
    // eslint-disable-next-line no-console
    console.log('saved category', category, 'for row', row)
    // Optionally update dummyTransactions or call a refresh/update function
  }

  const columns = useTransactionsColumns(handleOpenCategorise)

  const { sortModel, page, pageSize, setPage, setPageSize, handleSortChange } =
    useFetchSortedPaginatedData()

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
        boxSizing: 'border-box',
        borderRadius: '24px',
        bgcolor: '#FAFAFA',
        overflow: 'hidden',
        px: 0,
        py: 0
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
            width: '100%'
          }}
        >
          <DataGrid
            rows={dummyTransactions}
            columns={columns}
            getRowId={(row) => row.id}
            pageSizeOptions={[5, 10, 25, { value: -1, label: 'All' }]}
            disableColumnMenu
            disableColumnResize
            getRowHeight={() => 'auto'}
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
              bgcolor: 'transparent',
              border: 'none',

              '& .MuiDataGrid-virtualScroller': {
                backgroundColor: 'transparent',
                overflowX: 'hidden'
              },

              '& .MuiDataGrid-cell': {
                py: 1,
                backgroundColor: 'transparent'
              },

              '& .MuiDataGrid-columnHeaders': {
                backgroundColor: '#F5F5F5',
                borderBottom: 'none'
              },

              '& .MuiDataGrid-columnHeader': {
                backgroundColor: '#F5F5F5'
              },

              '& .MuiDataGrid-columnHeadersInner': {
                backgroundColor: '#F5F5F5'
              },

              '& .MuiDataGrid-row:hover': {
                backgroundColor: '#f5f5f5'
              },

              '& .MuiDataGrid-main': {
                overflow: 'visible'
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
        count={dummyTransactions.length}
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

      <CategorisationModal
        open={categorisationOpen}
        onClose={handleCloseCategorise}
        onSave={handleSaveCategory}
        row={selectedRow}
      />
    </Box>
  )
}

export default TransactionsTable
