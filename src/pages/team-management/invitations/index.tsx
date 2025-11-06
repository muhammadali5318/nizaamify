// SentInvitations.tsx (updated to prevent full-page scroll)
import React, { useState, useMemo } from 'react'
import { Box, Stack, TablePagination, Typography } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'

import TeamManagementContentWrapper from '../components/TeamManagementContentWrapper'
import useFetchTeamMembers from '../hooks/useFetchTeamMembers'
import { useTeamMembersColumns } from './hooks/useSentInvitationsColumns'
import { teamMembersSx } from '../team-management-config'
import ConfirmationSuccessDialog from 'src/components/team-management/InvitationSuccessDialog'
import { getRoleLabel } from 'src/components/team-management/common/team-management'
import { useAuth } from 'src/context/AuthProvider'
import { useInitialData } from 'src/hooks/useFetchInitialData'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import { notify } from 'src/components/notistack/NotificationProvider'
import { queryClient } from 'src/utils/queryClient'

import styles from './invitations.module.scss'
import { useFetchSortedPaginatedData } from 'src/hooks/useFetchSortedData.'
import PendingRequests from './components/PendingRequests'
import { useActivePractice } from 'src/hooks/useActivePractice'

const SentInvitations: React.FC = () => {
  const { activePracticeId } = useActivePractice()
  const { accessToken } = useAuth()
  const { data: practiceData } = useInitialData(!!accessToken)

  // Sorting + Pagination (Reusable Hook)
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

  // Local UI state
  const [successDialogOpen, setSuccessDialogOpen] = useState(false)
  const [localLoading, setLocalLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState<{
    email: string
    role: string
  }>({
    email: '',
    role: ''
  })

  // Fetch data
  const { items, total, isLoading } = useFetchTeamMembers({
    page,
    pageSize,
    user_practice_status: ['INVITED', 'RESEND INVITE'],
    ordering,
    sortOrder
  })

  // Handlers
  const handleOpenSuccessDialog = () => setSuccessDialogOpen(true)
  const handleCloseSuccessDialog = () => setSuccessDialogOpen(false)

  const handleInvite = async ({
    email,
    role
  }: {
    email: string
    role: string
  }) => {
    setSelectedUser({ email, role })
    try {
      setLocalLoading(true)
      await apiClient.post(endpoints.resendInvite(activePracticeId ?? ''), {
        invited_user_email: email
      })
      handleOpenSuccessDialog()
      await queryClient.invalidateQueries({ queryKey: ['teamMembersListApi'] })
    } catch {
      notify.error('Failed to resend invitation')
    } finally {
      setLocalLoading(false)
    }
  }

  const handlers = { onInvite: handleInvite }
  const columns = useTeamMembersColumns(handlers)

  // Sum minWidth to prevent column shrinking
  const totalMinWidth = useMemo(() => {
    return columns.reduce((sum, col) => {
      const colMin = (col as any).minWidth ?? (col as any).width ?? 120
      return sum + Number(colMin)
    }, 0)
  }, [columns])

  const getRowClassName = (params: any) =>
    params.row.status === 'Disabled' ? styles.rowDisabled : ''

  return (
    <Stack spacing={2.5}>
      <PendingRequests />
      <TeamManagementContentWrapper
        imageSrc='/assets/bg-black-clock-icon.svg'
        imageAlt='sent invitation icons'
        title='Sent Invitations'
        subtitle='Manage invitations that have been sent to users'
      >
        <Box
          sx={{
            width: '100%',
            maxWidth: '100vw',
            boxSizing: 'border-box'
          }}
        >
          {items?.length === 0 && !isLoading ? (
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
                No invitations sent
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
                    loading={localLoading || isLoading}
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

        <ConfirmationSuccessDialog
          open={successDialogOpen}
          onClose={handleCloseSuccessDialog}
          onSubmit={handleCloseSuccessDialog}
          title='Invitation sent!'
        >
          <Typography variant='body2' color='text.secondary'>
            An invitation has been sent to{' '}
            <Typography component='span' color='text.primary' fontWeight={700}>
              {selectedUser?.email}
            </Typography>{' '}
            to join{' '}
            <Typography component='span' color='text.primary' fontWeight={700}>
              {practiceData?.practice_name}
            </Typography>{' '}
            as a{' '}
            <Typography component='span' color='text.primary' fontWeight={700}>
              {getRoleLabel(selectedUser?.role)}
            </Typography>
            .
          </Typography>

          <Typography variant='body2' color='text.secondary' mt={1}>
            They’ll receive an email with instructions to set up their account.
          </Typography>
        </ConfirmationSuccessDialog>
      </TeamManagementContentWrapper>
    </Stack>
  )
}

export default SentInvitations
