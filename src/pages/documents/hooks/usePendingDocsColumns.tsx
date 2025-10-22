import { useMemo } from 'react'
import { GridColDef, GridCellParams } from '@mui/x-data-grid'
import { Box, Typography, IconButton, Tooltip, Button } from '@mui/material'
import dayjs from 'dayjs'
import RemoveRedEyeOutlinedIcon from '@mui/icons-material/RemoveRedEyeOutlined'

type Handlers = {
  onView: () => void
  onViewDownload: () => void
  onSwap?: (id: string) => void
  onNominate?: (id: string) => void
}

export const usePendingDocsColumns = (
  handlers: Handlers,
  isPendingDocments: boolean
) => {
  const { onView, onViewDownload } = handlers

  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: 'Document-name',
        headerName: 'Document name',
        minWidth: 250,
        flex: 1,
        sortable: false,
        renderCell: (params: GridCellParams) => (
          <Typography variant='body2'>{params.value}</Typography>
        )
      },
      {
        field: 'type',
        headerName: 'Type',
        minWidth: 140,
        flex: 1,
        sortable: true,
        renderCell: (params: GridCellParams) => (
          <Typography variant='body2'>{params.value}</Typography>
        )
      },
      {
        field: 'Subtype',
        headerName: 'Subtype',
        minWidth: 130,
        flex: 1,
        sortable: true,
        renderCell: (params: GridCellParams) => (
          <Typography variant='body2'>{params.value}</Typography>
        )
      },
      {
        field: 'Document date',
        headerName: 'Document date',
        minWidth: 140,
        flex: 1,
        sortable: true,
        renderCell: (params: GridCellParams) => (
          <Typography variant='body2'>
            {dayjs(params.value as string).format('DD MMM YYYY')}
          </Typography>
        )
      },
      {
        field: 'Uploaded-by',
        headerName: 'Uploaded by',
        minWidth: 140,
        flex: 1,
        sortable: true,
        renderCell: (params: GridCellParams) => (
          <Typography variant='body2'>{params.value}</Typography>
        )
      },
      {
        field: 'actions',
        headerName: 'Actions',
        minWidth: 200,
        flex: 1,
        sortable: false,
        renderCell: () => (
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <Tooltip title='View document'>
              <IconButton size='small'>
                <RemoveRedEyeOutlinedIcon
                  fontSize='small'
                  onClick={() => onViewDownload()}
                />
              </IconButton>
            </Tooltip>
            {isPendingDocments ? (
              <Button size='small' variant='outlined' onClick={() => onView()}>
                Add Payment Date
              </Button>
            ) : (
              <Tooltip title='View document'>
                <IconButton size='small'>
                  <img
                    src='/assets/document-download.svg'
                    alt='download icon'
                  />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        )
      }
    ],
    [onView, onViewDownload]
  )

  return columns
}

export type { GridColDef } from '@mui/x-data-grid'
