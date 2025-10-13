import { useCallback, useEffect, useState } from 'react'
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  TablePagination,
  Typography
} from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import TeamManagementContentWrapper from '../components/TeamManagementContentWrapper'
import styles from './teamMembers.module.scss'
import { teamMembersSx } from '../team-management-config'
import { useTeamMembersColumns } from './hooks/useTeamMembersColumns'
import { useFetchTeamMembers } from '../hooks/useFetchTeamMembers'
import { MenuProps, STATUS_OPTIONS } from '../team-members-config'
import { NoResultsBox } from './components/TeamMembers'
import { USER_ROLES } from 'src/const'
import { convertArrayToUpperCase } from 'src/utils/arrayUtils'
import NominatePracticeManagerTeamList from '../components/NominatePracticeManagerTeamList'
import ConfirmationSuccessDialog from 'src/components/team-management/InvitationSuccessDialog'
import { useFetchSortedPaginatedData } from 'src/hooks/useFetchSortedData.'

interface TeamMembersProps {
  onCountsUpdate?: (counts: {
    total_users: number
    active_users: number
    pending_invited_users: number
  }) => void
}

type TeamMemberRow = {
  id?: string | number
  user_name?: string
  user_id?: string
  // allow other fields
  [k: string]: any
}

const TeamMembers: React.FC<TeamMembersProps> = ({ onCountsUpdate }) => {
  const [isNominateOpen, setIsNominateOpen] = useState(false)
  const [successDialogOpen, setSuccessDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<{
    name: string
    userId: string
  } | null>(null)

  // 🔹 Filters
  const [searchKey, setSearchKey] = useState<string>('')
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])

  // 🔹 Sorting + Pagination (using reusable hook)
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

  // 🔹 API call with synced sorting + pagination
  const { items, teamUsersCounts, total, isLoading } = useFetchTeamMembers({
    page,
    pageSize,
    search: searchKey,
    user_role: selectedRoles,
    user_practice_status: convertArrayToUpperCase(selectedStatuses),
    ordering,
    sortOrder
  })

  // 🔹 Update parent with counts
  useEffect(() => {
    if (teamUsersCounts && onCountsUpdate) {
      const normalizedCounts = {
        total_users: teamUsersCounts.total_users ?? 0,
        active_users: teamUsersCounts.active_users ?? 0,
        pending_invited_users: teamUsersCounts.pending_invited_users ?? 0
      }
      onCountsUpdate(normalizedCounts)
    }
  }, [teamUsersCounts, onCountsUpdate])

  const handleClearFilters = () => {
    setSearchKey('')
    setSelectedRoles([])
    setSelectedStatuses([])
    setPage(0)
  }

  const getRowClassName = (params: any) =>
    params.row.status === 'Disabled' ? styles.rowDisabled : ''

  const handleNominate = useCallback((row?: TeamMemberRow) => {
    if (!row) {
      console.warn('No user row provided for nomination')
      return
    }

    setSelectedUser({
      name: row.user_name ?? '',
      userId: row.user_id ?? String(row.id ?? '')
    })
    setIsNominateOpen(true)
  }, [])

  const handlers = {
    onNominate: handleNominate
  }

  const columns = useTeamMembersColumns(handlers)

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
            placeholder='Search by name'
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
              {USER_ROLES.map((role) => (
                <MenuItem key={role.value} value={role.value}>
                  <Checkbox checked={selectedRoles.indexOf(role.value) > -1} />
                  <ListItemText primary={role.label} />
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
      <Box sx={{ width: '100%' }}>
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
          loading={isLoading}
          onSortModelChange={handleSortChange}
          sx={teamMembersSx}
          slots={{
            noRowsOverlay: () => (
              <NoResultsBox
                loading={isLoading}
                searchKey={searchKey}
                onClear={handleClearFilters}
              />
            )
          }}
        />

        <TablePagination
          className='pagination-container'
          rowsPerPageOptions={[5, 10, 25, 50]}
          component='div'
          count={total ?? 0}
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

      {/* Nominate Dialog */}
      <NominatePracticeManagerTeamList
        open={isNominateOpen}
        onClose={() => setIsNominateOpen(false)}
        onSuccess={() => setSuccessDialogOpen(true)}
        name={selectedUser?.name ?? ''}
        userId={selectedUser?.userId ?? ''}
      />

      {/* Success Dialog */}
      <ConfirmationSuccessDialog
        open={successDialogOpen}
        onClose={() => setSuccessDialogOpen(false)}
        title='Nomination successful!'
      >
        <Typography variant='body2' color='text.secondary'>
          You’ve successfully nominated{' '}
          <Typography component='span' color='text.primary' fontWeight={700}>
            {selectedUser?.name}
          </Typography>{' '}
          to complete the practice onboarding process.
        </Typography>

        <Typography variant='body2' color='text.secondary' mt={1}>
          They’ll receive an email notification and now have access to the
          onboarding form.
        </Typography>
      </ConfirmationSuccessDialog>
    </TeamManagementContentWrapper>
  )
}

export default TeamMembers
