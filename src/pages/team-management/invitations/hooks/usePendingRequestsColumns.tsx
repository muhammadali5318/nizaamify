import { useMemo } from 'react'
import { GridColDef, GridCellParams } from '@mui/x-data-grid'
import { Box, Typography, IconButton, Tooltip } from '@mui/material'
import { toTitleCase } from 'src/utils/stringUtils'
import dayjs from 'dayjs'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import HighlightOffIcon from '@mui/icons-material/HighlightOff'

type Handlers = {
  onView?: (id: string) => void
  onInvite?: (data: { email: string; role: string }) => void
  onSwap?: (id: string) => void
  onNominate?: (id: string) => void
}

export const usePendingRequestsColumns = (handlers: Handlers = {}) => {
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
        flex: 0.7,
        sortable: true,
        renderCell: (params: GridCellParams) => (
          <Typography variant='body2'>
            {toTitleCase(params?.row?.user_role)}
          </Typography>
        )
      },
      {
        field: 'phone_number',
        headerName: 'Phone Number',
        minWidth: 100,
        flex: 0.7,
        sortable: true,
        renderCell: () => {
          return <Typography variant='body2'>+44 9202948721</Typography>
        }
      },
      {
        field: 'Reason',
        headerName: 'Reason',
        minWidth: 300,
        flex: 1,
        sortable: true,
        renderCell: (params: GridCellParams) => {
          // Prefer normalized "reason" field, fallback to capitalized "Reason"
          const text =
            params?.row?.reason ??
            params?.row?.Reason ??
            'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed doeiusmod tempor incididunt Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed doeiusmod tempor incididunt Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed doeiusmod tempor incididunt' // fallback if nothing present

          return (
            <Tooltip title={text} placement='top'>
              <Typography
                variant='body2'
                sx={{
                  display: 'block', // allow width to be respected
                  width: '100%',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {text}
              </Typography>
            </Tooltip>
          )
        }
      },
      {
        field: 'invitation_expired_at',
        headerName: 'Date Arrived',
        minWidth: 120,
        flex: 0.7,
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
        renderCell: () => {
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
              <Tooltip placement='top' title={'Approve request'}>
                <IconButton size='small' aria-label='invite member'>
                  <CheckCircleOutlineIcon
                    sx={{
                      color: '#4CAF50'
                    }}
                  />
                </IconButton>
              </Tooltip>
              <Tooltip placement='top' title={'Reject request'}>
                <IconButton size='small' aria-label='invite member'>
                  <HighlightOffIcon
                    sx={{
                      color: '#D32F2F'
                    }}
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
