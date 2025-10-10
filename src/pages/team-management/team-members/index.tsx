/* eslint-disable no-console */
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
import { DataGrid, GridSortModel } from '@mui/x-data-grid'
import TeamManagementContentWrapper from '../components/TeamManagementContentWrapper'
import styles from './teamMembers.module.scss'
import { teamMembersSx } from '../team-management-config'
import { useTeamMembersColumns } from './hooks/useTeamMembersColumns'
import { useFetchTeamMembers } from '../hooks/useFetchTeamMembers'
import { MenuProps, STATUS_OPTIONS } from '../team-members-config'
import { NoResultsBox } from './components/TeamMembers'
import { USER_ROLES } from 'src/const'
import { convertArrayToUpperCase } from 'src/utils/arrayUtils.'
import NominatePracticeManagerTeamList from '../components/NominatePracticeManagerTeamList'
import ConfirmationSuccessDialog from 'src/components/team-management/InvitationSuccessDialog'

interface TeamMembersProps {
  onCountsUpdate?: (counts: {
    total_users: number
    active_users: number
    pending_invited_users: number
  }) => void
}

const TeamMembers: React.FC<TeamMembersProps> = ({ onCountsUpdate }) => {
  const [isNominateOpen, setIsNominateOpen] = useState(false)
  const [successDialogOpen, setSuccessDialogOpen] = useState(false)

  const handleCloseNominate = () => setIsNominateOpen(false)
  const handleOpenSuccessDialog = () => setSuccessDialogOpen(true)
  const handleCloseSuccessDialog = () => setSuccessDialogOpen(false)
  const [selectedUser, setSelectedUser] = useState<{
    name: string
    userId: string
  } | null>(null)
  // filter state
  const [searchKey, setSearchKey] = useState<string>('')
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])

  const [localLoading, setLocalLoading] = useState<boolean>(false)

  // pagination
  const [page, setPage] = useState<number>(0)
  const [pageSize, setPageSize] = useState<number>(10)

  // sort model
  const [sortModel, setSortModel] = useState<GridSortModel>([])

  const { items, teamUsersCounts, total, isLoading } = useFetchTeamMembers({
    page,
    pageSize,
    search: searchKey,
    user_role: selectedRoles,
    user_practice_status: convertArrayToUpperCase(selectedStatuses),
    ordering: sortModel[0]?.field,
    sortOrder: sortModel[0]?.sort
  })

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

  const fetchSortedData = useCallback(
    (model: GridSortModel) => {
      if (JSON.stringify(model) === JSON.stringify(sortModel)) return

      setLocalLoading(true)
      setPage(0)
      setTimeout(() => {
        setSortModel(model)
        setLocalLoading(false)
      }, 300)
    },
    [sortModel]
  )

  const handleClearFilters = () => {
    setSearchKey('')
    setSelectedRoles([])
    setSelectedStatuses([])
    setPage(0)
  }

  const getRowClassName = (params: any) => {
    return params.row.status === 'Disabled' ? styles.rowDisabled : ''
  }

  const handleNominate = useCallback(
    (id: string) => {
      const user = items.find((item) => String(item.id) === id)
      if (user) {
        setSelectedUser({
          name: user?.user_name ?? '',
          userId: user.user_id ?? ''
        })
        setIsNominateOpen(true)
      } else {
        console.warn('No user found for nomination:', id)
      }
    },
    [items]
  )

  const handlers = {
    onView: (id: string) => console.log('view', id),
    onInvite: (id: string) => console.log('invite', id),
    onSwap: (id: string) => console.log('swap', id),
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
          loading={localLoading || isLoading}
          slots={{
            noRowsOverlay: () => (
              <NoResultsBox
                loading={localLoading || isLoading}
                searchKey={searchKey}
                onClear={handleClearFilters}
              />
            )
          }}
          onSortModelChange={(model: GridSortModel) => fetchSortedData(model)}
          sx={teamMembersSx}
        />

        <TablePagination
          className='pagination-container'
          rowsPerPageOptions={[5, 10, 25, 50]}
          component='div'
          count={total ?? 0}
          rowsPerPage={pageSize}
          page={page}
          onPageChange={(_, newPage) => {
            setPage(newPage)
          }}
          onRowsPerPageChange={(event) => {
            const newSize = parseInt(event.target.value, 10)
            setPageSize(newSize)
            setPage(0)
          }}
          showFirstButton
          showLastButton
        />
      </Box>
      <NominatePracticeManagerTeamList
        open={isNominateOpen}
        onClose={handleCloseNominate}
        onSuccess={handleOpenSuccessDialog}
        name={selectedUser?.name ?? ''}
        userId={selectedUser?.userId ?? ''}
      />

      <ConfirmationSuccessDialog
        open={successDialogOpen}
        onClose={handleCloseSuccessDialog}
        title='Nomination successful!'
      >
        <Typography variant='body2' color='text.secondary'>
          You’ve successfully nominated{' '}
          <Typography component='span' color='text.primary' fontWeight={700}>
            {selectedUser?.name}
          </Typography>{' '}
          to complete the practice onboarding process.to complete the practice
          onboarding process.{' '}
        </Typography>

        <Typography variant='body2' color='text.secondary' mt={1}>
          They’ll receive an email notification and now have access to the
          onboarding form.{' '}
        </Typography>
      </ConfirmationSuccessDialog>
    </TeamManagementContentWrapper>
  )
}

export default TeamMembers
