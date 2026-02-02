import { useMemo } from 'react'
import { GridColDef, GridCellParams } from '@mui/x-data-grid'
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Button,
  CircularProgress
} from '@mui/material'
import dayjs from 'dayjs'
import { bytesToReadableSize } from 'src/utils/bytesToMB'

type Handlers = {
  onView: (id: string) => void
  onViewDownload: (id: string) => void
}

export const usePendingDocsColumns = (
  handlers: Handlers,
  isPendingDocuments: boolean,
  downloadingId: string | null
) => {
  const { onView, onViewDownload } = handlers

  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: 'file_name',
        headerName: 'Document name',
        minWidth: 250,
        flex: 1,
        sortable: false,
        renderCell: (params: GridCellParams) => {
          const fileName = params?.row?.file_name || ''
          const fileSize = params?.row?.file_size

          return (
            <Box>
              <Tooltip placement='top' title={fileName}>
                <Typography
                  variant='body2'
                  noWrap
                  sx={{
                    maxWidth: 220,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'block'
                  }}
                >
                  {fileName}
                </Typography>
              </Tooltip>
              <Typography variant='body2'>
                {bytesToReadableSize(fileSize)}
              </Typography>
            </Box>
          )
        }
      },
      {
        field: 'document_type',
        headerName: 'Category',
        minWidth: 140,
        flex: 1,
        sortable: true,
        renderCell: (params: GridCellParams) => (
          <Typography variant='body2'>
            {params?.row?.document_type ?? '-'}
          </Typography>
        )
      },
      {
        field: 'document_subtype',
        headerName: 'Subcategory',
        minWidth: 130,
        flex: 1,
        sortable: true,
        renderCell: (params: GridCellParams) => (
          <Typography variant='body2'>
            {params?.row?.document_subtype ?? '-'}
          </Typography>
        )
      },
      {
        field: 'upload_timestamp',
        headerName: 'Uploaded on',
        minWidth: 140,
        flex: 1,
        sortable: true,
        renderCell: (params: GridCellParams) => (
          <Typography variant='body2'>
            {dayjs(params?.row?.upload_timestamp as string).format(
              'DD MMM YYYY'
            )}
          </Typography>
        )
      },
      {
        field: 'user_name',
        headerName: 'Uploaded by',
        minWidth: 140,
        flex: 1,
        sortable: true,
        renderCell: (params: GridCellParams) => (
          <Typography variant='body2'>{params?.row?.user_name}</Typography>
        )
      },
      {
        field: 'actions',
        headerName: 'Actions',
        minWidth: 200,
        flex: 1,
        sortable: false,
        renderCell: (params: GridCellParams) => {
          const isRowLoading = downloadingId === params?.row?.id

          return (
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
              <Tooltip title='Download document' placement='top'>
                <span>
                  <IconButton
                    size='small'
                    onClick={() => onViewDownload(params?.row?.id)}
                    disabled={!!downloadingId}
                  >
                    {isRowLoading ? (
                      <CircularProgress size={20} />
                    ) : (
                      <img
                        src='/assets/document-download.svg'
                        alt='download icon'
                      />
                    )}
                  </IconButton>
                </span>
              </Tooltip>

              {isPendingDocuments && (
                <Button
                  size='small'
                  variant='outlined'
                  onClick={() => onView(params?.row?.id)}
                >
                  Add Payment Date
                </Button>
              )}
            </Box>
          )
        }
      }
    ],
    [onView, onViewDownload, isPendingDocuments, downloadingId]
  )

  return columns
}

export type { GridColDef } from '@mui/x-data-grid'
