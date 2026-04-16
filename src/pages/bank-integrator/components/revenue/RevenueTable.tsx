import { useMemo, useState, useCallback, useEffect } from 'react'
import {
  Box,
  Button,
  IconButton,
  TablePagination,
  Tooltip,
  Typography
} from '@mui/material'
import { flushSync } from 'react-dom'
import { useTheme } from '@mui/material/styles'
import { DataGrid, GridRowSelectionModel, GridRowId } from '@mui/x-data-grid'
import FirstPageIcon from '@mui/icons-material/FirstPage'
import LastPageIcon from '@mui/icons-material/LastPage'
import KeyboardArrowLeft from '@mui/icons-material/KeyboardArrowLeft'
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import type { MouseEvent } from 'react'

import { useFetchSortedPaginatedData } from 'src/hooks/useFetchSortedData.'
import CategorisationModal from '../categorisation-modal'
import { useFetchRevenueTransactions } from '../../hooks/useFetchRevenueTransactions'
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
import { useRevenueColumns } from '../../hooks/useRevenueColumns'

const MAX_SELECTED_ROWS = 10
const DEFAULT_PAGE_SIZE = 10

const RevenueTable = () => {
  const theme = useTheme()
  const { accessToken } = useAuth()
  const { activePracticeId } = useActivePractice()
  const dispatch = useDispatch()

  const [categorisationOpen, setCategorisationOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [isCategorising, setIsCategorising] = useState(false)
  const [selectedRow, setSelectedRow] = useState<any | null>(null)
  const [modalInitial, setModalInitial] = useState<any | null>(null)

  const [rowSelectionModel, setRowSelectionModel] =
    useState<GridRowSelectionModel>({
      type: 'include',
      ids: new Set<GridRowId>()
    })

  const selectedCount = rowSelectionModel.ids.size

  // Cache selected rows across pages so we can build the final payload safely.
  const [selectedRowCache, setSelectedRowCache] = useState<Record<string, any>>(
    {}
  )

  const categories = useSelector((s: any) => selectAllCategories(s))

  const { sortModel, page, pageSize, setPage, setPageSize, handleSortChange } =
    useFetchSortedPaginatedData()

  // Force page size to 10 and prevent changes.
  useEffect(() => {
    if (pageSize !== DEFAULT_PAGE_SIZE) {
      setPageSize(DEFAULT_PAGE_SIZE)
    }
  }, [pageSize, setPageSize])

  const queryParams = useMemo(
    () => ({
      page,
      page_size: DEFAULT_PAGE_SIZE,
      ordering: sortModel?.[0]?.field,
      sortOrder: sortModel?.[0]?.sort ?? undefined,
      is_paginated: true
    }),
    [page, sortModel]
  )

  const { data, isPending } = useFetchRevenueTransactions(queryParams, {
    enabled: !!accessToken
  })

  const rows = useMemo(() => data?.results ?? [], [data])

  const handleOpenCategorise = useCallback(
    (row: any) => {
      const idStr = String(row?.id ?? '')
      const local = categories?.[idStr]

      if (local) {
        setModalInitial({
          ...local,
          lineItem: local.lineItem ?? local.expense_category ?? null
        })
      } else if (row?.category && row?.type && row?.subtype) {
        setModalInitial({
          category: row.category,
          type: row.type,
          subtype: row.subtype,
          lineItem: row.expense_category ?? null
        })
      } else {
        setModalInitial(null)
      }

      setSelectedRow(row)
      setCategorisationOpen(true)
    },
    [categories]
  )

  const columns = useRevenueColumns(categories, handleOpenCategorise)

  // Keep selection limited to 10 rows and preserve control across pages.
  const normalizeSelection = useCallback((ids: Iterable<GridRowId>) => {
    const unique: GridRowId[] = []
    const seen = new Set<string>()

    for (const id of ids) {
      const idStr = String(id)
      if (seen.has(idStr)) continue

      seen.add(idStr)
      unique.push(id)

      if (unique.length === MAX_SELECTED_ROWS) break
    }

    return {
      type: 'include' as const,
      ids: new Set<GridRowId>(unique)
    }
  }, [])

  const handleRowSelectionModelChange = useCallback(
    (newModel: GridRowSelectionModel) => {
      // DataGrid can pass either the current include model or an exclude model
      // depending on the UI action/version. We keep the controlled state in the
      // include format so the rest of the component stays predictable.
      const selectedIds = newModel?.ids ?? new Set<GridRowId>()

      setRowSelectionModel((prev) => {
        const next = normalizeSelection(selectedIds)

        // Avoid needless state updates when nothing actually changed.
        const prevIds = Array.from(prev.ids).map(String)
        const nextIds = Array.from(next.ids).map(String)

        if (
          prev.type === next.type &&
          prevIds.length === nextIds.length &&
          prevIds.every((id, index) => id === nextIds[index])
        ) {
          return prev
        }

        return next
      })
    },
    [normalizeSelection]
  )

  // Cache selected rows from the current page so cross-page bulk payloads stay accurate.
  useEffect(() => {
    const selectedIds = new Set(Array.from(rowSelectionModel.ids).map(String))

    setSelectedRowCache((prev) => {
      const nextCache: Record<string, any> = {}

      Object.keys(prev).forEach((id) => {
        if (selectedIds.has(id)) {
          nextCache[id] = prev[id]
        }
      })

      rows.forEach((row: any) => {
        const idStr = String(row.id)
        if (selectedIds.has(idStr)) {
          nextCache[idStr] = row
        }
      })

      return nextCache
    })
  }, [rowSelectionModel, rows])

  // Keep pagination locked once any row is selected, matching the current UX.
  const paginationLocked = selectedCount > 0 || isCategorising

  const handleSaveCategory = (category: any, row?: any) => {
    const id = row?.id ?? row?.row?.id
    if (!id) return
    dispatch(setCategory({ id, category }))
  }

  const handleCloseCategorise = () => {
    setCategorisationOpen(false)
    setSelectedRow(null)
    setModalInitial(null)
  }

  const getLastValidPage = (count: number) =>
    Math.max(0, Math.ceil(count / DEFAULT_PAGE_SIZE) - 1)

  const handleUpdateAll = useCallback(async () => {
    if (isCategorising || selectedCount === 0) return

    const selectedIds = Array.from(rowSelectionModel.ids)

    const included_transactions: string[] = []
    const excluded_transactions: Array<{
      transaction_id: string
      type: string
      subtype: string
      expense_category: string | null
    }> = []

    for (const id of selectedIds) {
      const idStr = String(id)

      const local = categories?.[idStr]
      const cachedRow = selectedRowCache[idStr]
      const currentRow = rows.find((r: any) => String(r.id) === idStr)
      const sourceRow = local ?? cachedRow ?? currentRow

      const type = sourceRow?.type ?? null
      const subtype = sourceRow?.subtype ?? null
      const expense_category =
        sourceRow?.expense_category ??
        sourceRow?.lineItem ??
        sourceRow?.category ??
        null

      const isCategorised = Boolean(type && subtype && expense_category)

      if (isCategorised) {
        excluded_transactions.push({
          transaction_id: idStr,
          type,
          subtype,
          expense_category
        })
      } else {
        included_transactions.push(idStr)
      }
    }

    if (!included_transactions.length && !excluded_transactions.length) {
      notify.error('No valid transactions to update.')
      return
    }

    const currentTotalCount = data?.count ?? 0
    const nextTotalCount = Math.max(
      0,
      currentTotalCount -
        excluded_transactions.length -
        included_transactions.length
    )
    const lastValidPage = getLastValidPage(nextTotalCount)
    const nextPage = Math.min(page, lastValidPage)

    try {
      setIsCategorising(true)

      await apiClient.post(
        endpoints.bankIntegrator.revenueTransactionsCategorise(
          activePracticeId ?? ''
        ),
        {
          excluded_transactions,
          included_transactions
        }
      )

      // Move to a valid page first if the current page becomes empty.
      if (nextPage !== page) {
        flushSync(() => {
          setPage(nextPage)
        })
      }

      await queryClient.invalidateQueries({
        queryKey: ['revenueTransactions']
      })

      dispatch(clearCategories())
      setRowSelectionModel({ type: 'include', ids: new Set<GridRowId>() })
      setSelectedRowCache({})

      notify.success('Transactions updated successfully.')
    } catch (err) {
      console.error(err)
      notify.error('Bulk update failed.')
    } finally {
      setIsCategorising(false)
    }
  }, [
    isCategorising,
    selectedCount,
    rowSelectionModel,
    categories,
    selectedRowCache,
    rows,
    data?.count,
    page,
    activePracticeId,
    dispatch,
    setPage
  ])

  const TablePaginationActions = useCallback(
    (props: {
      count: number
      page: number
      rowsPerPage: number
      onPageChange: (event: MouseEvent<HTMLButtonElement>, page: number) => void
    }) => {
      const { count, page, onPageChange } = props
      const lastPage = Math.max(0, Math.ceil(count / DEFAULT_PAGE_SIZE) - 1)

      return (
        <Box sx={{ flexShrink: 0, ml: 2.5 }}>
          <IconButton
            onClick={(e) => onPageChange(e, 0)}
            disabled={paginationLocked || page === 0}
            aria-label='first page'
            size='small'
          >
            {theme.direction === 'rtl' ? <LastPageIcon /> : <FirstPageIcon />}
          </IconButton>
          <IconButton
            onClick={(e) => onPageChange(e, page - 1)}
            disabled={paginationLocked || page === 0}
            aria-label='previous page'
            size='small'
          >
            {theme.direction === 'rtl' ? (
              <KeyboardArrowRight />
            ) : (
              <KeyboardArrowLeft />
            )}
          </IconButton>
          <IconButton
            onClick={(e) => onPageChange(e, page + 1)}
            disabled={paginationLocked || page >= lastPage}
            aria-label='next page'
            size='small'
          >
            {theme.direction === 'rtl' ? (
              <KeyboardArrowLeft />
            ) : (
              <KeyboardArrowRight />
            )}
          </IconButton>
          <IconButton
            onClick={(e) => onPageChange(e, lastPage)}
            disabled={paginationLocked || page >= lastPage}
            aria-label='last page'
            size='small'
          >
            {theme.direction === 'rtl' ? <FirstPageIcon /> : <LastPageIcon />}
          </IconButton>
        </Box>
      )
    },
    [paginationLocked, theme.direction]
  )

  return (
    <Box>
      <Box display='flex' justifyContent='flex-end'>
        <Box sx={{ p: 2 }} display='flex' gap={1}>
          <Tooltip
            open={infoOpen}
            onClose={() => setInfoOpen(false)}
            title={
              <Typography sx={{ fontSize: 13, lineHeight: 1.5 }}>
                You can select up to 10 transactions at a time. Once you select
                any transaction, pagination will be locked until you confirm the
                categorisation.
              </Typography>
            }
            arrow
            placement='top'
          >
            <IconButton
              size='small'
              onClick={() => setInfoOpen((prev) => !prev)}
              onMouseEnter={() => setInfoOpen(true)}
              onMouseLeave={() => setInfoOpen(false)}
              sx={{ ml: 0.5 }}
            >
              <HelpOutlineIcon fontSize='medium' />
            </IconButton>
          </Tooltip>

          <Button
            variant='contained'
            disabled={!selectedCount || isCategorising}
            onClick={handleUpdateAll}
          >
            {isCategorising
              ? 'Updating...'
              : `Confirm Categorisation (${selectedCount})`}
          </Button>
        </Box>
      </Box>

      <Box
        sx={{ borderRadius: '24px', bgcolor: '#FAFAFA', overflow: 'hidden' }}
      >
        <Box sx={{ overflowX: 'auto' }}>
          <DataGrid
            rows={rows}
            columns={columns}
            getRowId={(row) => row.id}
            checkboxSelection
            disableRowSelectionOnClick
            keepNonExistentRowsSelected
            rowSelectionModel={rowSelectionModel}
            onRowSelectionModelChange={handleRowSelectionModelChange}
            sortingMode='server'
            sortModel={sortModel}
            onSortModelChange={handleSortChange}
            disableColumnMenu
            loading={isPending}
            hideFooter
            isRowSelectable={() => true}
            sx={{
              ...teamMembersSx,
              border: 'none',
              '& .MuiDataGrid-columnHeaders': { backgroundColor: '#F5F5F5' }
            }}
            slots={{
              noRowsOverlay: () => (
                <NoResultsBox loading={false} searchKey='' onClear={() => {}} />
              )
            }}
          />
        </Box>

        <TablePagination
          component='div'
          count={data?.count ?? 0}
          rowsPerPage={DEFAULT_PAGE_SIZE}
          page={page}
          rowsPerPageOptions={[]}
          onPageChange={(_, newPage) => setPage(newPage)}
          ActionsComponent={TablePaginationActions}
        />

        <CategorisationModal
          open={categorisationOpen}
          onClose={handleCloseCategorise}
          onSave={handleSaveCategory}
          row={selectedRow}
          initial={modalInitial ?? undefined}
          showDatePicker={false}
          modalType='uncategorisedRevenue'
        />
      </Box>
    </Box>
  )
}

export default RevenueTable
