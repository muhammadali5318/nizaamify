/* eslint-disable no-console */
import { useMemo } from 'react'
import { GridColDef, GridCellParams } from '@mui/x-data-grid'
import { Box, Typography, IconButton, Tooltip } from '@mui/material'
import { StatusChip, ImgIcon } from '../components/TeamMembers'
import { toTitleCase } from 'src/utils/stringUtils'

type Handlers = {
  onView?: (id: string) => void
  onInvite?: (id: string) => void
  onSwap?: (id: string) => void
  onNominate?: (id: any) => void
}

export const useTeamMembersColumns = (handlers: Handlers = {}) => {
  const { onView, onInvite, onSwap, onNominate } = handlers

  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: 'member',
        headerName: 'Members',
        // removed flex; rely on minWidth so column never shrinks below usable size
        minWidth: 250,
        flex: 1,
        sortable: false,
        renderCell: (params: GridCellParams) => (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <Typography variant='body2'>{params?.row?.user_name}</Typography>
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
        field: 'actions',
        headerName: 'Actions',
        minWidth: 170,
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
            <Tooltip placement='top' title='View'>
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

            <Tooltip placement='top' title='Invite / Add'>
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

            <Tooltip placement='top' title='Swap'>
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

            {params.row.user_role === 'PRACTICE MANAGER' &&
              params.row.user_practice_status === 'ACTIVE' && (
                <Tooltip
                  placement='top'
                  title={
                    params?.row?.is_nominated
                      ? 'Already nominated'
                      : 'Nominate now'
                  }
                >
                  <IconButton
                    size='small'
                    aria-label='Nomination flag'
                    onClick={() =>
                      onNominate
                        ? onNominate(params.row)
                        : console.log('nominate', params.row.id)
                    }
                  >
                    <ImgIcon
                      src={
                        params?.row?.is_nominated
                          ? '/assets/green-flag.svg'
                          : '/assets/blue-flag.svg'
                      }
                      alt='flag icon'
                    />
                  </IconButton>
                </Tooltip>
              )}
          </Box>
        )
      }
    ],
    [onView, onInvite, onSwap, onNominate]
  )

  return columns
}

export type { GridColDef } from '@mui/x-data-grid'
