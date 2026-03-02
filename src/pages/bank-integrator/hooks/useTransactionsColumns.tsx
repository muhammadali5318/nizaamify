import { useMemo } from 'react'
import { GridColDef, GridCellParams } from '@mui/x-data-grid'
import { Button, Chip, Typography } from '@mui/material'
import { toTitleCase } from 'src/utils/stringUtils'

type UseTransactionsColumns = (
  onCategorise?: (row: any) => void
) => GridColDef[]

export const useTransactionsColumns: UseTransactionsColumns = (
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
          <Typography variant='body2'>{params?.row?.created_at}</Typography>
        )
      },
      {
        field: 'Description',
        headerName: 'Description',
        minWidth: 250,
        flex: 1,
        sortable: true,
        renderCell: (params: GridCellParams) => {
          return (
            <Typography variant='body2'>
              {toTitleCase(params?.row?.event_description) || '-'}
            </Typography>
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
            {toTitleCase(params?.row?.actor_type) || '-'}
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
          const value = params?.row?.event_feature?.toLowerCase()

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
              case 'error':
                return {
                  color: 'error.main',
                  backgroundColor: 'rgba(211, 47, 47, 0.15)'
                }
              case 'adjustment':
                return {
                  color: 'warning.main',
                  backgroundColor: 'rgba(237, 108, 2, 0.15)'
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
              label={params?.row?.event_feature}
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
        flex: 1,
        sortable: false,
        renderCell: () => {
          return (
            <Typography
              color='text.secondary'
              variant='caption'
              sx={{
                fontStyle: 'italic'
              }}
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
          return (
            <Button
              variant='outlined'
              onClick={() => {
                if (onCategorise) onCategorise(params.row)
              }}
            >
              Categorise
            </Button>
          )
        }
      }
    ],
    []
  )

  return columns
}

export type { GridColDef } from '@mui/x-data-grid'
