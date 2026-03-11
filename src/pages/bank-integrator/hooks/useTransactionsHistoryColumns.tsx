// src/hooks/useReconciliationColumns.ts

import { useMemo } from 'react'
import { GridColDef, GridCellParams } from '@mui/x-data-grid'
import { Typography } from '@mui/material'

import { useActivePractice } from 'src/hooks/useActivePractice'

import { useSelector } from 'react-redux'
import {
  selectAllPresignFiles,
  selectAllUploadingFiles
} from 'src/store/slices/reconciliationTabPresignDataSlice'
import dayjs from 'dayjs'

export const useTransactionsHistoryColumns = (): GridColDef[] => {
  const { accountingBasis } = useActivePractice()

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

      // =============================
      // Description
      // =============================
      {
        field: 'Category',
        headerName: 'Category',
        flex: 1,
        sortable: true,
        renderCell: (params: GridCellParams) => {
          const category = params?.row?.category || '-'

          return <Typography variant='body2'>{category ?? '-'}</Typography>
        }
      },

      // =============================
      // Debit
      // =============================
      {
        field: 'Type',
        headerName: 'Type',
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
        headerName: 'Subtype',
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
        field: 'uploaded on',
        headerName: 'Uploaded on',
        flex: 1,
        sortable: false,
        renderCell: (params: GridCellParams) => {
          return (
            <Typography variant='body2'>
              {dayjs(params?.row?.created_at).format('DD/MM/YYYY') ?? '-'}
            </Typography>
          )
        }
      },
      {
        field: 'uploaded by',
        headerName: 'Uploaded by',
        flex: 1,
        sortable: false,
        renderCell: (params: GridCellParams) => {
          return (
            <Typography variant='body2'>
              {params?.row?.uploaded_by_name ?? '-'}
            </Typography>
          )
        }
      }
    ]

    return baseColumns
  }, [accountingBasis, presignFiles, uploadingFiles])

  return columns
}

export type { GridColDef } from '@mui/x-data-grid'
