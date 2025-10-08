/* eslint-disable no-console */
import { useMemo } from 'react'
import { GridColDef, GridCellParams } from '@mui/x-data-grid'
import { Box, Typography, IconButton, Tooltip } from '@mui/material'
import { StatusChip, ImgIcon } from '../team-members/components/TeamMembers'

type Handlers = {
  onView?: (id: string) => void
  onInvite?: (id: string) => void
  onSwap?: (id: string) => void
  onDelete?: (id: string) => void
}

export const useTeamMembersColumns = (handlers: Handlers = {}) => {
  const { onView, onInvite, onSwap, onDelete } = handlers

  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: 'member',
        headerName: 'Members',
        flex: 1,
        sortable: false,
        renderCell: (params: GridCellParams) => (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <Typography variant='body2'>{params.row.name}</Typography>
              <Typography variant='body2' sx={{ lineHeight: 1 }}>
                {params.row.email}
              </Typography>
            </Box>
          </Box>
        )
      },
      {
        field: 'role',
        headerName: 'Role',
        flex: 1,
        sortable: true,
        renderCell: (params: GridCellParams) => (
          <Typography variant='body2'>{params.row.role}</Typography>
        )
      },
      {
        field: 'status',
        headerName: 'Status',
        flex: 1,
        sortable: true,
        renderCell: (params: GridCellParams) => {
          return <StatusChip status={params.row.status} />
        }
      },
      {
        field: 'actions',
        headerName: 'Actions',
        flex: 1,
        sortable: false,
        renderCell: (params: GridCellParams) => (
          <Box
            sx={{
              display: 'flex',
              gap: 0.6,
              justifyContent: 'flex-start',
              width: '100%',
              alignItems: 'center'
            }}
          >
            <Tooltip title='View'>
              <IconButton
                size='small'
                onClick={() =>
                  onView
                    ? onView(String(params.row.id))
                    : console.log('view', params.row.id)
                }
                aria-label='view member'
              >
                <ImgIcon src='/assets/transparent-eye.svg' alt='view' />
              </IconButton>
            </Tooltip>

            <Tooltip title='Invite / Add'>
              <IconButton
                size='small'
                onClick={() =>
                  onInvite
                    ? onInvite(String(params.row.id))
                    : console.log('invite', params.row.id)
                }
                aria-label='invite member'
              >
                <ImgIcon src='/assets/person-add.svg' alt='invite' />
              </IconButton>
            </Tooltip>

            <Tooltip title='Swap'>
              <IconButton
                size='small'
                onClick={() =>
                  onSwap
                    ? onSwap(String(params.row.id))
                    : console.log('swap', params.row.id)
                }
                aria-label='swap member'
              >
                <ImgIcon src='/assets/swap-icon.svg' alt='swap' />
              </IconButton>
            </Tooltip>

            <Tooltip title='Delete'>
              <IconButton
                size='small'
                onClick={() =>
                  onDelete
                    ? onDelete(String(params.row.id))
                    : console.log('delete', params.row.id)
                }
                aria-label='delete member'
              >
                <ImgIcon src='/assets/green-flag.svg' alt='flag icon' />
              </IconButton>
            </Tooltip>
          </Box>
        )
      }
    ],
    [onView, onInvite, onSwap, onDelete]
  )

  return columns
}

export type { GridColDef } from '@mui/x-data-grid'
