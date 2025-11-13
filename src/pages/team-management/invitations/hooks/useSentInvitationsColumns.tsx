import { useMemo } from 'react'
import { GridColDef, GridCellParams } from '@mui/x-data-grid'
import { Box, Typography, IconButton, Tooltip } from '@mui/material'
import { toTitleCase } from 'src/utils/stringUtils'
import { ImgIcon, StatusChip } from '../../team-members/components/TeamMembers'
import dayjs from 'dayjs'

type Handlers = {
  onView?: (id: string) => void
  onInvite?: (data: { email: string; role: string }) => void
  onSwap?: (id: string) => void
  onNominate?: (id: string) => void
}

export const useTeamMembersColumns = (handlers: Handlers = {}) => {
  const { onInvite } = handlers

  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: 'member',
        headerName: 'Members',
        minWidth: 250,
        flex: 1,
        sortable: false,
        renderCell: (params: GridCellParams) => (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <Typography variant='body2' sx={{ lineHeight: 1 }}>
                {params?.row?.email}
              </Typography>
            </Box>
          </Box>
        )
      },
      {
        field: 'user_role',
        headerName: 'Role',
        minWidth: 140,
        flex: 1,
        sortable: true,
        renderCell: (params: GridCellParams) => (
          <Typography variant='body2'>
            {toTitleCase(params?.row?.user_role)}
          </Typography>
        )
      },
      {
        field: 'user_practice_status',
        headerName: 'Status',
        minWidth: 130,
        flex: 1,
        sortable: true,
        renderCell: (params: GridCellParams) => {
          return <StatusChip status={params?.row?.user_practice_status} />
        }
      },
      {
        field: 'invitation_created_at',
        headerName: 'Sent Date',
        minWidth: 140,
        flex: 1,
        sortable: true,
        renderCell: (params: GridCellParams) => (
          <Typography variant='body2'>
            {params?.row?.invitation_created_at
              ? dayjs(params.row.invitation_created_at).format('DD/MM/YYYY')
              : '-'}
          </Typography>
        )
      },
      {
        field: 'invitation_expired_at',
        headerName: 'Expire',
        minWidth: 140,
        flex: 1,
        sortable: true,
        renderCell: (params: GridCellParams) => (
          <Typography variant='body2'>
            {params?.row?.invitation_expired_at
              ? dayjs(params.row.invitation_expired_at).format('DD/MM/YYYY')
              : '-'}
          </Typography>
        )
      },
      {
        field: 'actions',
        headerName: 'Actions',
        minWidth: 90,
        flex: 1,
        sortable: false,
        renderCell: (params: GridCellParams) => {
          const isResendInvite =
            params?.row?.user_practice_status === 'RESEND INVITE'

          return (
            <Box
              sx={{
                display: 'flex',
                gap: 0.6,
                justifyContent: 'flex-start',
                width: '100%',
                alignItems: 'center'
              }}
            >
              <Tooltip
                placement='top'
                title={
                  isResendInvite ? 'Resend Invite' : 'Invite not available'
                }
              >
                <IconButton
                  size='small'
                  onClick={
                    isResendInvite
                      ? () => {
                          if (onInvite) {
                            onInvite({
                              email: params.row?.email,
                              role: params.row?.user_role
                            })
                          } else {
                            // eslint-disable-next-line no-console
                          }
                        }
                      : undefined
                  }
                  aria-label='invite member'
                  disabled={!isResendInvite}
                >
                  <ImgIcon
                    src={
                      isResendInvite
                        ? '/assets/re-sync-active.svg'
                        : '/assets/re-sync-inactive.svg'
                    }
                    alt='invite'
                  />
                </IconButton>
              </Tooltip>
            </Box>
          )
        }
      }
    ],
    [onInvite]
  )

  return columns
}

export type { GridColDef } from '@mui/x-data-grid'
