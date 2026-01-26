import { useMemo } from 'react'
import { GridColDef, GridCellParams } from '@mui/x-data-grid'
import { Box, Typography, IconButton, Tooltip } from '@mui/material'
import { toTitleCase } from 'src/utils/stringUtils'
import dayjs from 'dayjs'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import HighlightOffIcon from '@mui/icons-material/HighlightOff'
import { ApproveOrReject } from '../components/UserConfirmatinoModal'

type Handlers = {
  onApprove?: (userId: string, mode: ApproveOrReject) => void
  onReject?: (userId: string, mode: ApproveOrReject) => void
}

export const usePendingRequestsColumns = (handlers: Handlers = {}) => {
  const { onApprove, onReject } = handlers

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
          const text = params?.row?.access_request_reason ?? '-'

          return (
            <Tooltip title={text} placement='top'>
              <Typography
                variant='body2'
                sx={{
                  display: 'block',
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
            {dayjs(params.row.created_at).format('DD/MM/YYYY') ?? '-'}
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
                <IconButton
                  size='small'
                  aria-label='Approve member'
                  onClick={() => onApprove?.(params?.row?.user_id, 'ACTIVE')}
                >
                  <CheckCircleOutlineIcon
                    sx={{
                      color: '#4CAF50'
                    }}
                  />
                </IconButton>
              </Tooltip>
              <Tooltip placement='top' title={'Reject request'}>
                <IconButton
                  size='small'
                  aria-label='Reject member'
                  onClick={() => onReject?.(params?.row?.user_id, 'REJECTED')}
                >
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
    [onApprove, onReject]
  )

  return columns
}

export type { GridColDef } from '@mui/x-data-grid'
