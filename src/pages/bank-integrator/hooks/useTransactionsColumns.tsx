import { useMemo } from 'react'
import { GridColDef, GridCellParams } from '@mui/x-data-grid'
import { Box, Button, Chip, Typography } from '@mui/material'
import { toTitleCase } from 'src/utils/stringUtils'
import dayjs from 'dayjs'

type UseTransactionsColumns = (
  categories: Record<string, any>,
  onCategorise?: (row: any) => void
) => GridColDef[]

export const useTransactionsColumns: UseTransactionsColumns = (
  categories,
  onCategorise
) => {
  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: 'Transaction Date',
        headerName: 'Transaction Date',
        minWidth: 150,
        flex: 1,
        sortable: false,
        renderCell: (params: GridCellParams) => (
          <Typography variant='body2'>
            {params?.row?.date
              ? dayjs(params.row.date).format('DD/MM/YYYY')
              : '-'}
          </Typography>
        )
      },
      {
        field: 'Description',
        headerName: 'Description',
        minWidth: 250,
        flex: 1,
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
      {
        field: 'Amount',
        headerName: 'Amount',
        minWidth: 140,
        flex: 1,
        sortable: true,
        renderCell: (params: GridCellParams) => (
          <Typography variant='body2'>
            {params?.row?.amount ? `£${params?.row?.amount}` : '-'}
          </Typography>
        )
      },
      {
        field: 'Type',
        headerName: 'Type',
        minWidth: 140,
        flex: 1,
        sortable: true,
        renderCell: (params: GridCellParams) => {
          const value = Number(params?.row?.amount) > 0 ? 'credit' : 'debit'

          const getStyles = () => {
            switch (value) {
              case 'credit':
                return {
                  color: 'success.main',
                  backgroundColor: 'rgba(76, 175, 80, 0.15)'
                }
              case 'debit':
                return {
                  color: 'info.main',
                  backgroundColor: 'rgba(2, 136, 209, 0.15)'
                }
              default:
                return {
                  color: 'rgb(97, 97, 97)',
                  backgroundColor: 'rgba(97, 97, 97, 0.15)'
                }
            }
          }

          return (
            <Chip
              label={value}
              size='small'
              sx={{
                border: 'none',
                px: '6px',
                ...getStyles()
              }}
            />
          )
        }
      },
      {
        field: 'Category',
        headerName: 'Category',
        minWidth: 150,
        flex: 1.5,
        sortable: false,
        renderCell: (params) => {
          const row = params.row
          const idStr = String(row?.id ?? '')

          // API values
          const hasApiCategory =
            !!row?.category && !!row?.type && !!row?.subtype

          // RTK values
          const localCategory = categories?.[idStr]

          const hasLocalCategory =
            !!localCategory?.category &&
            !!localCategory?.type &&
            !!localCategory?.subtype

          if (hasLocalCategory) {
            return (
              <Box display={'flex'} gap={1}>
                <img src='/assets/checked-icon.svg' alt='checked icon' />
                <Typography
                  variant='caption'
                  color='success.main'
                  fontStyle={'italic'}
                >
                  {localCategory.type} / {localCategory.subtype}
                </Typography>
              </Box>
            )
          }

          if (hasApiCategory) {
            return (
              <Box display={'flex'} gap={1}>
                <img src='/assets/checked-icon.svg' alt='checked icon' />
                <Typography
                  variant='caption'
                  color='success.main'
                  fontStyle={'italic'}
                >
                  {row.type} / {row.subtype}
                </Typography>
              </Box>
            )
          }

          return (
            <Typography
              color='text.secondary'
              variant='caption'
              sx={{ fontStyle: 'italic' }}
            >
              Not categorised
            </Typography>
          )
        }
      },
      {
        field: 'Actions',
        headerName: 'Actions',
        minWidth: 150,
        flex: 1,
        sortable: false,
        renderCell: (params: GridCellParams) => {
          const row = params.row
          const idStr = String(row?.id ?? '')
          const hasApiCategory =
            !!row?.category && !!row?.type && !!row?.subtype

          const localCategory = categories?.[idStr]

          const hasLocalCategory =
            !!localCategory?.category &&
            !!localCategory?.type &&
            !!localCategory?.subtype
          return (
            <Button
              variant='outlined'
              onClick={() => {
                if (onCategorise) onCategorise(params.row)
              }}
            >
              {hasApiCategory || hasLocalCategory ? 'Edit' : 'Categorise'}
            </Button>
          )
        }
      }
    ],
    [categories, onCategorise]
  )

  return columns
}

export type { GridColDef } from '@mui/x-data-grid'
