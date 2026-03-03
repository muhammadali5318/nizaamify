// src/components/transactions/TransactionsTable.tsx
import { useMemo, useState, useCallback } from 'react'
import { Box, Button, TablePagination } from '@mui/material'
import { DataGrid, GridRowSelectionModel, GridRowId } from '@mui/x-data-grid'
import { useTransactionsColumns } from '../../hooks/useTransactionsColumns'
import { useFetchSortedPaginatedData } from 'src/hooks/useFetchSortedData.'
import CategorisationModal from '../categorisation-modal'
import { useFetchUncategorisedTransactions } from '../../hooks/useFetchUncategorisedTransactions'
import { useAuth } from 'src/context/AuthProvider'
import { teamMembersSx } from 'src/pages/team-management/team-management-config'
import { NoResultsBox } from 'src/pages/team-management/team-members/components/TeamMembers'
import {
  setCategory,
  selectAllCategories,
  clearCategories
} from 'src/store/slices/transactionsTableSlice'
import { useDispatch, useSelector } from 'react-redux'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import { useActivePractice } from 'src/hooks/useActivePractice'
import { queryClient } from 'src/utils/queryClient'
import { notify } from 'src/components/notistack/NotificationProvider'

const TransactionsTable = () => {
  const { accessToken } = useAuth()
  const { activePracticeId } = useActivePractice()

  const [categorisationOpen, setCategorisationOpen] = useState(false)
  const [selectedRow, setSelectedRow] = useState<any | null>(null)

  // NEW: modalInitial holds the defaults passed to the modal
  const [modalInitial, setModalInitial] = useState<{
    category?: string
    type?: string
    subtype?: string
    lineItem?: string
  } | null>(null)

  const [rowSelectionModel, setRowSelectionModel] =
    useState<GridRowSelectionModel>({
      type: 'include',
      ids: new Set<GridRowId>()
    })

  // read categories map from RTK (must be above useTransactionsColumns)
  const categories = useSelector((s: any) => selectAllCategories(s))

  // pass categories and handler into the columns hook
  const columns = useTransactionsColumns(categories, (row: any) =>
    handleOpenCategorise(row)
  )

  const { sortModel, page, pageSize, setPage, setPageSize, handleSortChange } =
    useFetchSortedPaginatedData()

  const queryParams = useMemo(
    () => ({
      page,
      page_size: pageSize,
      ordering: sortModel?.[0]?.field,
      sortOrder: sortModel?.[0]?.sort ?? undefined,
      is_paginated: true
    }),
    [page, pageSize, sortModel]
  )

  const { data, isPending } = useFetchUncategorisedTransactions(queryParams, {
    enabled: !!accessToken
  })

  const dispatch = useDispatch()

  const handleSaveCategory = (category: any, row?: any) => {
    const id = row?.id ?? row?.row?.id
    if (!id) {
      console.warn('handleSaveCategory: missing row id', row)
      return
    }

    // merge/save into slice under key = row id
    dispatch(setCategory({ id, category }))

    // eslint-disable-next-line no-console
    console.log('saved category', category, 'for row', id)
  }

  const handleCloseCategorise = () => {
    setCategorisationOpen(false)
    setSelectedRow(null)
    setModalInitial(null)
  }

  const rows = useMemo(() => data?.results ?? [], [data])

  /**
   * OPEN MODAL: compute initial according to priority:
   * 1) RTK (categories[id]) -> use as-is
   * 2) else API row if it has category/type/subtype
   * 3) else empty (modal will use its own default for category)
   */
  const handleOpenCategorise = useCallback(
    (row: any) => {
      const idStr = String(row?.id ?? '')

      // 1) Prefer RTK
      const local = categories?.[idStr]

      if (local) {
        setModalInitial({
          category: local.category ?? undefined,
          type: local.type ?? undefined,
          subtype: local.subtype ?? undefined,
          lineItem: local.lineItem ?? local.expense_category ?? undefined
        })
      } else if (row?.category && row?.type && row?.subtype) {
        // 2) fallback to API row if it has full classification
        setModalInitial({
          category: row.category,
          type: row.type,
          subtype: row.subtype,
          lineItem: row.expense_category ?? row.expenseCategory ?? undefined
        })
      } else {
        // 3) nothing available — pass null so modal will use its internal defaults
        setModalInitial(null)
      }

      setSelectedRow(row)
      setCategorisationOpen(true)
    },
    [categories]
  )

  // ... handleUpdateAll stays the same (unchanged from your previously approved implementation)
  const handleUpdateAll = useCallback(async () => {
    const selectedIds = rowSelectionModel.ids // Set<GridRowId>
    if (!selectedIds || selectedIds.size === 0) return

    const transactions = Array.from(selectedIds)
      .map((id) => {
        const idStr = String(id)

        const local = categories?.[idStr]
        if (local) {
          if (!local.category || !local.type || !local.subtype) {
            console.warn(
              `Local category for ${idStr} is incomplete. Required: category,type,subtype. Skipping.`,
              local
            )
            return null
          }

          return {
            transaction_id: idStr,
            category: local.category,
            type: local.type,
            subtype: local.subtype,
            expense_category: local.lineItem ?? local.expense_category ?? null,
            is_verified: true
          }
        }

        const row = rows.find((r: any) => String(r.id) === idStr)
        if (!row) {
          console.warn(
            `Selected transaction ${idStr} not found in rows, skipping`
          )
          return null
        }

        if (row.category && row.type && row.subtype) {
          return {
            transaction_id: idStr,
            category: row.category,
            type: row.type,
            subtype: row.subtype,
            expense_category:
              row.expense_category ?? row.expenseCategory ?? null,
            is_verified: true
          }
        }

        console.warn(
          `Transaction ${idStr} has no complete category in RTK or API (needs category,type,subtype). Skipping.`,
          { row, local }
        )
        return null
      })
      .filter((t): t is NonNullable<typeof t> => t !== null)

    if (transactions.length === 0) {
      console.warn(
        'No transactions to update (no complete categories found for selected rows).'
      )
      notify.error(
        'No valid transactions to update. Please categorise selected rows first.'
      )
      return
    }

    const payload = { transactions }

    // eslint-disable-next-line no-console
    console.log('Bulk payload (sending):', JSON.stringify(payload, null, 2))

    try {
      const res = await apiClient.post(
        endpoints.bankIntegrator.uncategorisedTransactionsUpdate(
          activePracticeId ?? ''
        ),
        payload
      )

      // eslint-disable-next-line no-console
      console.log('Bulk update response:', res?.data ?? res)

      // invalidate caches
      await queryClient.invalidateQueries({
        queryKey: ['unverifiedTransactionsListApi']
      })
      await queryClient.invalidateQueries({
        queryKey: ['uncategorisedTransactions']
      })

      // clear RTK categories
      dispatch(clearCategories())

      // clear selection
      setRowSelectionModel({
        type: 'include',
        ids: new Set<GridRowId>()
      })

      notify.success('Transaction categorised successfully.')
    } catch (err: any) {
      console.error('Bulk update error:', err)

      const serverData = err?.response?.data
      if (serverData) {
        console.error('Server response:', serverData)
        if (serverData.error) {
          console.error('Validation error details:', serverData.error)
          notify.error(
            Array.isArray(serverData.error.transactions)
              ? `Validation: ${serverData.error.transactions.join(', ')}`
              : 'Validation error'
          )
        } else if (typeof serverData.message === 'string') {
          notify.error(serverData.message)
        } else {
          notify.error('Bulk update failed - see console for details.')
        }
      } else {
        notify.error('Bulk update failed - network or unexpected error.')
      }
    }
  }, [
    rowSelectionModel,
    categories,
    rows,
    apiClient,
    endpoints,
    activePracticeId,
    queryClient,
    notify,
    dispatch,
    setRowSelectionModel
  ])

  const totalMinWidth = useMemo(() => {
    return columns.reduce((sum, col) => {
      const colMin = (col as any).minWidth ?? (col as any).width ?? 120
      return sum + Number(colMin)
    }, 0)
  }, [columns])

  return (
    <Box>
      <Box display={'flex'} justifyContent={'flex-end'}>
        {/* ✅ Show button only if at least 1 selected */}
        {rowSelectionModel.ids.size > 0 && (
          <Box sx={{ p: 2 }}>
            <Button variant='contained' onClick={handleUpdateAll}>
              Categorise ({rowSelectionModel.ids.size})
            </Button>
          </Box>
        )}
      </Box>
      <Box
        sx={{
          width: '100%',
          maxWidth: '100vw',
          boxSizing: 'border-box',
          borderRadius: '24px',
          bgcolor: '#FAFAFA',
          overflow: 'hidden',
          px: 0,
          py: 0
        }}
      >
        <Box
          sx={{
            width: '100%',
            maxWidth: '90vw',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            boxSizing: 'border-box'
          }}
        >
          <Box
            sx={{
              minWidth: `${totalMinWidth}px`,
              width: '100%'
            }}
          >
            <DataGrid
              rows={rows}
              columns={columns}
              getRowId={(row) => row.id}
              checkboxSelection
              isRowSelectable={(params) => {
                const row = params.row
                const idStr = String(params.id ?? '')

                const hasApiCategory =
                  !!row?.category && !!row?.type && !!row?.subtype

                const hasLocalCategory = !!categories?.[idStr]

                return hasApiCategory || hasLocalCategory
              }}
              disableRowSelectionOnClick
              rowSelectionModel={rowSelectionModel}
              onRowSelectionModelChange={(newModel) =>
                setRowSelectionModel(newModel)
              }
              sortingMode='server'
              sortModel={sortModel}
              loading={isPending}
              onSortModelChange={handleSortChange}
              hideFooter
              sx={{
                ...teamMembersSx,
                width: '100%',
                minWidth: `${totalMinWidth}px`,
                boxSizing: 'border-box',
                bgcolor: 'transparent',
                border: 'none',

                '& .MuiDataGrid-virtualScroller': {
                  backgroundColor: 'transparent',
                  overflowX: 'hidden'
                },

                '& .MuiDataGrid-cell': {
                  py: 1,
                  backgroundColor: 'transparent'
                },

                '& .MuiDataGrid-columnHeaders': {
                  backgroundColor: '#F5F5F5',
                  borderBottom: 'none'
                },

                '& .MuiDataGrid-columnHeader': {
                  backgroundColor: '#F5F5F5'
                },

                '& .MuiDataGrid-columnHeadersInner': {
                  backgroundColor: '#F5F5F5'
                },

                '& .MuiDataGrid-row:hover': {
                  backgroundColor: '#f5f5f5'
                },

                '& .MuiDataGrid-main': {
                  overflow: 'visible'
                }
              }}
              slots={{
                noRowsOverlay: () => (
                  <NoResultsBox
                    loading={false}
                    searchKey={''}
                    // eslint-disable-next-line no-console
                    onClear={() => console.log('cleared')}
                  />
                )
              }}
            />
          </Box>
        </Box>

        <TablePagination
          component='div'
          count={data?.count ?? 0}
          rowsPerPage={pageSize}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          onRowsPerPageChange={(event) => {
            const newSize = parseInt(event.target.value, 10)
            setPageSize(newSize)
            setPage(0)
          }}
        />

        <CategorisationModal
          open={categorisationOpen}
          onClose={handleCloseCategorise}
          onSave={handleSaveCategory}
          row={selectedRow}
          initial={modalInitial ?? undefined}
        />
      </Box>
    </Box>
  )
}

export default TransactionsTable
