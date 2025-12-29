/* eslint-disable no-console */
import { useMemo } from 'react'
import { GridColDef, GridCellParams } from '@mui/x-data-grid'
import { Box, Typography, IconButton, Tooltip } from '@mui/material'
import RemoveRedEyeOutlinedIcon from '@mui/icons-material/RemoveRedEyeOutlined'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import { useAuth0 } from '@auth0/auth0-react'
import { toTitleCase } from 'src/utils/stringUtils'
import ImgIcon from 'src/components/common/ImgIcon'

type Handlers = {
  onView?: () => void
}

export const useAuditLogsColumns = (handlers: Handlers = {}) => {
  const { onView } = handlers
  const { user } = useAuth0()

  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: 'member',
        headerName: 'Date & Time',
        minWidth: 150,
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
        field: 'Size',
        headerName: 'User',
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
        field: 'Uploaded-by',
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
        field: 'Upload-Date',
        headerName: 'Logs Category	',
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
        field: 'actions',
        headerName: 'Actions',
        minWidth: 170,
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
              <Tooltip placement='top' title='Manage member permissions'>
                <Box
                  component='span'
                  sx={{
                    display: 'inline-flex',
                    verticalAlign: 'middle'
                  }}
                >
                  <IconButton
                    size='small'
                    aria-label='view member'
                    disabled={params?.row?.user_practice_status !== 'ACTIVE'}
                    onClick={() => console.log('view', params.row.id)}
                  >
                    <RemoveRedEyeOutlinedIcon fontSize='small' />
                  </IconButton>
                </Box>
              </Tooltip>

              <Tooltip
                placement='top'
                title={
                  params?.row?.has_other_active_practices
                    ? 'Unlink user from practice'
                    : 'Delete user from Monai'
                }
              >
                <Box
                  component='span'
                  sx={{
                    display: 'inline-flex',
                    verticalAlign: 'middle'
                  }}
                >
                  <IconButton
                    size='small'
                    disabled={
                      params.row.user_practice_status !== 'ACTIVE' ||
                      params?.row?.email === user?.email
                    }
                    onClick={() => console.log('INvite')}
                    aria-label='invite member'
                  >
                    <ImgIcon
                      src={
                        params?.row?.has_other_active_practices
                          ? params.row.user_practice_status !== 'ACTIVE' ||
                            params?.row?.email === user?.email
                            ? '/assets/inactive-unlink.svg'
                            : '/assets/active-unlink.svg'
                          : params.row.user_practice_status !== 'ACTIVE' ||
                              params?.row?.email === user?.email
                            ? '/assets/inactive-trash.svg'
                            : '/assets/active-trash.svg'
                      }
                      alt='invite'
                    />
                  </IconButton>
                </Box>
              </Tooltip>

              <Tooltip placement='top' title='Update member role'>
                <Box
                  component='span'
                  sx={{
                    display: 'inline-flex',
                    verticalAlign: 'middle'
                  }}
                >
                  <IconButton
                    size='small'
                    onClick={() => console.log('swap', params.row.id)}
                    aria-label='Update member role'
                  >
                    <SwapHorizIcon fontSize='small' />
                  </IconButton>
                </Box>
              </Tooltip>
            </Box>
          )
        }
      }
    ],
    [onView]
  )

  return columns
}

export type { GridColDef } from '@mui/x-data-grid'
