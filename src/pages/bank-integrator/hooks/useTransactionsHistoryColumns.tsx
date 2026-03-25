// src/hooks/useReconciliationColumns.ts

import { useMemo } from 'react'
import { GridColDef, GridCellParams } from '@mui/x-data-grid'
import {
  Box,
  CircularProgress,
  IconButton,
  Tooltip,
  Typography
} from '@mui/material'

import { useActivePractice } from 'src/hooks/useActivePractice'

import { useSelector } from 'react-redux'
import {
  selectAllPresignFiles,
  selectAllUploadingFiles
} from 'src/store/slices/reconciliationTabPresignDataSlice'
import dayjs from 'dayjs'

type Handlers = {
  onDownload: (id: any) => void
}
export const useTransactionsHistoryColumns = (
  handlers: Handlers,
  downloadingId: string
): GridColDef[] => {
  const { accountingBasis } = useActivePractice()
  const { onDownload } = handlers
  // Redux selectors
  const presignFiles = useSelector(selectAllPresignFiles)
  const uploadingFiles = useSelector(selectAllUploadingFiles)

  const columns: GridColDef[] = useMemo(() => {
    const baseColumns: GridColDef[] = [
      // =============================
      // Transaction Date
      // =============================
      {
        field: 'Document name',
        headerName: 'Document name',
        flex: 2,
        sortable: false,
        renderCell: (params: GridCellParams) => (
          <Typography variant='body2'>
            {params?.row?.file_name ?? '-'}
          </Typography>
        )
      },
      {
        field: 'type',
        headerName: 'Category',
        flex: 1,
        sortable: true,
        renderCell: (params: GridCellParams) => {
          return (
            <Typography variant='body2'>{params?.row?.type ?? '-'}</Typography>
          )
        }
      },

      // =============================
      // Balance
      // =============================
      {
        field: 'subtype',
        headerName: 'Subcategorty',
        flex: 1,
        sortable: true,
        renderCell: (params: GridCellParams) => {
          return (
            <Typography variant='body2'>
              {params?.row?.subtype ?? '-'}
            </Typography>
          )
        }
      },

      // =============================
      // Invoice Upload Column
      // =============================
      {
        field: 'line Item',
        headerName: 'Line item',
        flex: 1,
        sortable: false,
        renderCell: (params: GridCellParams) => {
          return (
            <Typography variant='body2'>
              {params?.row?.expense_category ?? '-'}
            </Typography>
          )
        }
      },
      {
        field: 'created_at',
        headerName: 'Uploaded on',
        flex: 1,
        sortable: true,
        renderCell: (params: GridCellParams) => {
          return (
            <Typography variant='body2'>
              {dayjs(params?.row?.created_at).format('DD/MM/YYYY') ?? '-'}
            </Typography>
          )
        }
      },
      {
        field: 'uploaded_by_name',
        headerName: 'Uploaded by',
        flex: 1,
        sortable: true,
        renderCell: (params: GridCellParams) => {
          return (
            <Typography variant='body2'>
              {params?.row?.uploaded_by_name ?? '-'}
            </Typography>
          )
        }
      },
      {
        field: 'download',
        headerName: 'Actions',
        flex: 1,
        sortable: true,
        renderCell: (params: GridCellParams) => {
          const isRowLoading = downloadingId === params?.row?.id

          return (
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
              <Tooltip title='Download document' placement='top'>
                <span>
                  <IconButton
                    size='small'
                    onClick={() => onDownload(params?.row?.id)}
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
            </Box>
          )
        }
      }
    ]

    return baseColumns
  }, [accountingBasis, presignFiles, uploadingFiles, onDownload, downloadingId])

  return columns
}

export type { GridColDef } from '@mui/x-data-grid'
