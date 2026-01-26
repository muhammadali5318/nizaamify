import { useMemo } from 'react'
import { GridColDef, GridCellParams } from '@mui/x-data-grid'
import { Box, Tooltip, Typography } from '@mui/material'
import { toTitleCase } from 'src/utils/stringUtils'

export const useAuditLogsColumns = () => {
  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: 'date-time',
        headerName: 'Date & Time',
        minWidth: 150,
        flex: 0.7,
        sortable: false,
        renderCell: (params: GridCellParams) => (
          <Typography variant='body2'>{params?.row?.created_at}</Typography>
        )
      },
      {
        field: 'user',
        headerName: 'User',
        minWidth: 250,
        flex: 1,
        sortable: true,
        renderCell: (params: GridCellParams) => {
          const name = params?.row?.actor_name || '-'
          const email = params?.row?.actor_email || '-'

          return (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                width: '100%',
                minWidth: 0 // 🔑 critical for ellipsis
              }}
            >
              <Tooltip placement='top' title={name} arrow>
                <Typography
                  variant='body2'
                  sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: {
                      xs: 'normal',
                      sm: 'nowrap'
                    }
                  }}
                >
                  {name}
                </Typography>
              </Tooltip>

              <Tooltip placement='top' title={email} arrow>
                <Typography
                  variant='body2'
                  sx={{
                    lineHeight: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    paddingBottom: 0.5,
                    whiteSpace: {
                      xs: 'normal',
                      sm: 'nowrap'
                    }
                  }}
                >
                  {email}
                </Typography>
              </Tooltip>
            </Box>
          )
        }
      },
      {
        field: 'role',
        headerName: 'Role',
        minWidth: 140,
        flex: 0.7,
        sortable: true,
        renderCell: (params: GridCellParams) => (
          <Typography variant='body2'>
            {toTitleCase(params?.row?.actor_type) || '-'}
          </Typography>
        )
      },
      {
        field: 'Upload-Date',
        headerName: 'Logs Category	',
        minWidth: 140,
        flex: 0.7,
        sortable: true,
        renderCell: (params: GridCellParams) => (
          <Typography variant='body2'>
            {toTitleCase(params?.row?.event_feature) || ''}
          </Typography>
        )
      },
      {
        field: 'actions',
        headerName: 'Actions',
        minWidth: 300,
        flex: 2.5,
        sortable: false,
        renderCell: (params: GridCellParams) => {
          return (
            <Typography
              variant='body2'
              sx={{
                whiteSpace: 'normal',
                wordBreak: 'break-word',
                lineHeight: 1.4
              }}
            >
              {params?.row?.event_description || '-'}
            </Typography>
          )
        }
      }
    ],
    []
  )

  return columns
}

export type { GridColDef } from '@mui/x-data-grid'
