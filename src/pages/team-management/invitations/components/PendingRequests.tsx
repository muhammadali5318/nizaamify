import { Box, TablePagination, Typography } from '@mui/material'
import PageHeader from 'src/components/page-header'
import styles from './PendingRequests.module.scss'
import { DataGrid } from '@mui/x-data-grid'
import { teamMembersSx } from '../../team-management-config'
import { useFetchSortedPaginatedData } from 'src/hooks/useFetchSortedData.'
import { useMemo } from 'react'
import useFetchTeamMembers from '../../hooks/useFetchTeamMembers'
import { usePendingRequestsColumns } from '../hooks/usePendingRequestsColumns'

const PendingRequests = () => {
  const {
    sortModel,
    page,
    pageSize,
    setPage,
    setPageSize,
    handleSortChange,
    ordering,
    sortOrder
  } = useFetchSortedPaginatedData()

  // Fetch data
  const { items, total, isLoading } = useFetchTeamMembers({
    page,
    pageSize,
    user_practice_status: ['PENDING'],
    ordering,
    sortOrder
  })

  const handleInvite = () => {
    // eslint-disable-next-line no-console
    console.log('hello world')
  }

  const handlers = { onInvite: handleInvite }
  const columns = usePendingRequestsColumns(handlers)

  const totalMinWidth = useMemo(() => {
    return columns.reduce((sum, col) => {
      const colMin = (col as any).minWidth ?? (col as any).width ?? 120
      return sum + Number(colMin)
    }, 0)
  }, [columns])

  const getRowClassName = (params: any) =>
    params.row.status === 'Disabled' ? styles.rowDisabled : ''

  return (
    <Box className={styles.pendingRequestsRoot}>
      <PageHeader
        title={'Pending requests'}
        description={
          'Requests will not be accepted into the Practice as staff until you verify them.'
        }
        logo='/assets/pending-member.svg'
        isDividerVisible={false}
        backgroundColor='rgba(239, 108, 0, 0.04)'
        containerPadding='16px'
      />

      <Box
        sx={{
          width: '100%',
          maxWidth: '100vw',
          boxSizing: 'border-box'
        }}
      >
        {/* {items?.length === 0 && !isLoading ? ( */}
        {items?.length === 0 && !isLoading ? (
          <Box
            height={200}
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
              No Pending Request
            </Typography>
          </Box>
        ) : (
          <>
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
                  rows={items}
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
                  onSortModelChange={handleSortChange}
                  loading={isLoading}
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
                    },
                    '& .MuiDataGrid-row': {
                      backgroundColor: 'rgba(239, 108, 0, 0.04)'
                    },
                    '& .MuiDataGrid-row:hover': {
                      backgroundColor: 'rgba(239, 108, 0, 0.08)'
                    },
                    '& .MuiDataGrid-row.Mui-selected': {
                      backgroundColor: 'rgba(239, 108, 0, 0.12) !important'
                    },

                    '& .MuiDataGrid-columnHeaders': {
                      backgroundColor: '#ffffff !important'
                    }
                  }}
                />
              </Box>
            </Box>

            <TablePagination
              className='pagination-container'
              rowsPerPageOptions={[5, 10, 25, 50]}
              component='div'
              count={total ?? 0}
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
    </Box>
  )
}

export default PendingRequests
