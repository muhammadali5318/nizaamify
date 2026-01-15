import { useMemo } from 'react'
import { GridColDef, GridCellParams } from '@mui/x-data-grid'
import { Box, Tooltip, Typography } from '@mui/material'
import { toTitleCase } from 'src/utils/stringUtils'

export const useReconciliationColumns = () => {
  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: 'Transaction date',
        headerName: 'Transaction Date',
        minWidth: 150,
        flex: 1,
        sortable: false,
        renderCell: (params: GridCellParams) => (
          <Typography variant='body2'>{params?.row?.created_at}</Typography>
        )
      },
      {
        field: 'user',
        headerName: 'Description',
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
        headerName: 'Debit',
        minWidth: 140,
        flex: 1,
        sortable: true,
        renderCell: (params: GridCellParams) => (
          <Typography variant='body2'>
            {toTitleCase(params?.row?.actor_type) || '-'}
          </Typography>
        )
      },
      {
        field: 'Upload-Date',
        headerName: 'Credit',
        minWidth: 140,
        flex: 1,
        sortable: true,
        renderCell: (params: GridCellParams) => (
          <Typography variant='body2'>
            {toTitleCase(params?.row?.event_feature) || ''}
          </Typography>
        )
      },
      {
        field: 'actions',
        headerName: 'Available Balance',
        minWidth: 300,
        flex: 1,
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
      },
      {
        field: 'Invoice',
        headerName: 'Invoice',
        minWidth: 300,
        flex: 1,
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
