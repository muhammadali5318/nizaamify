// src/hooks/useReconciliationColumns.ts

import { useMemo } from 'react'
import { GridColDef, GridCellParams } from '@mui/x-data-grid'
import { Box, Button, Chip, Typography, CircularProgress } from '@mui/material'

import CheckIcon from '@mui/icons-material/Check'

import { useActivePractice } from 'src/hooks/useActivePractice'
import { toTitleCase } from 'src/utils/stringUtils'

import { useSelector } from 'react-redux'
import {
  selectAllPresignFiles,
  selectAllUploadingFiles
} from 'src/store/slices/reconciliationTabPresignDataSlice'
import dayjs from 'dayjs'

type UseReconcileColumnsParams = {
  onCategorise?: (row: any) => void
  handleUploadFile?: (row: any) => void
}

export const useReconciliationColumns = ({
  onCategorise,
  handleUploadFile
}: UseReconcileColumnsParams): GridColDef[] => {
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
        field: 'Transaction date',
        headerName: 'Transaction Date',
        flex: 0.7,
        sortable: false,
        renderCell: (params: GridCellParams) => (
          <Typography variant='body2'>
            {params?.row?.date
              ? dayjs(params.row.date).format('DD/MM/YYYY')
              : '-'}
          </Typography>
        )
      },

      // =============================
      // Description
      // =============================
      {
        field: 'description',
        headerName: 'Description',
        flex: 1.8,
        sortable: true,
        renderCell: (params: GridCellParams) => {
          const counterparty = params?.row?.counterparty || '-'
          const reference = params?.row?.reference || ''
          const type = params?.row?.transaction_type || ''

          const secondaryText =
            [reference, type].filter(Boolean).map(toTitleCase).join(' • ') ||
            '-'

          return (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                minWidth: 0
              }}
            >
              <Typography
                variant='body2'
                sx={{
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {counterparty}
              </Typography>

              <Typography
                variant='caption'
                sx={{
                  color: 'text.secondary',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {secondaryText}
              </Typography>
            </Box>
          )
        }
      },

      // =============================
      // Debit
      // =============================
      {
        field: 'amount',
        headerName: 'Debit',
        flex: 1,
        sortable: true,
        renderCell: (params: GridCellParams) => {
          const amount = Number(params?.row?.amount)

          return (
            <Typography variant='body2'>
              {amount < 0 ? `£${Math.abs(amount)}` : '-'}
            </Typography>
          )
        }
      },

      // =============================
      // Balance
      // =============================
      {
        field: 'balance',
        headerName: 'Available Balance',
        flex: 1,
        sortable: true,
        renderCell: (params: GridCellParams) => {
          const balance = params?.row?.balance

          return (
            <Typography variant='body2'>
              {balance != null && balance !== ''
                ? `£${Number(balance).toLocaleString()}`
                : '-'}
            </Typography>
          )
        }
      },

      // =============================
      // Invoice Upload Column
      // =============================
      {
        field: 'Invoice',
        headerName: 'Invoice',
        flex: 1,
        sortable: false,
        renderCell: (params: GridCellParams) => {
          const rowId = params.row?.id

          const hasFile = Boolean(presignFiles[rowId])
          const isUploading = Boolean(uploadingFiles[rowId])

          // =============================
          // Uploading state
          // =============================
          if (isUploading) {
            return (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1
                }}
              >
                <Button variant='outlined' size='small'>
                  Uploading...
                </Button>{' '}
                <CircularProgress size={18} thickness={5} />
              </Box>
            )
          }

          // =============================
          // Uploaded state
          // =============================
          if (hasFile) {
            return (
              <Chip
                label='Uploaded'
                icon={
                  <img
                    src='/assets/green-verify-circle.svg'
                    alt='uploaded'
                    style={{ width: 16, height: 16 }}
                  />
                }
                clickable
                onClick={() => handleUploadFile?.(params.row)}
                sx={{
                  borderRadius: '100px',
                  fontWeight: 500,
                  backgroundColor: 'rgba(76, 175, 80, 0.15)',
                  color: 'success.main',

                  '&:hover': {
                    backgroundColor: 'rgba(76, 175, 80, 0.25)'
                  }
                }}
              />
            )
          }

          // =============================
          // Default state
          // =============================
          return (
            <Button
              variant='outlined'
              size='small'
              startIcon={
                <img src='/assets/document-download-black.svg' alt='upload' />
              }
              onClick={() => handleUploadFile?.(params.row)}
            >
              Upload invoice
            </Button>
          )
        }
      }
    ]

    // =============================
    // Confirm column (ACCRUAL only)
    // =============================

    if (accountingBasis === 'ACCRUAL') {
      baseColumns.push({
        field: 'fin',
        headerName: 'Add in financial calc.',
        flex: 1,
        sortable: false,
        renderCell: (params: GridCellParams) => (
          <Button
            variant='contained'
            size='small'
            startIcon={<CheckIcon />}
            onClick={() => onCategorise?.(params.row)}
          >
            Confirm
          </Button>
        )
      })
    }

    return baseColumns
  }, [
    accountingBasis,
    presignFiles,
    uploadingFiles,
    onCategorise,
    handleUploadFile
  ])

  return columns
}

export type { GridColDef } from '@mui/x-data-grid'
