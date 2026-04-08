import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import {
  Box,
  Button,
  IconButton,
  TablePagination,
  Tooltip,
  Typography
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { DataGrid, GridRowSelectionModel, GridRowId } from '@mui/x-data-grid'
import FirstPageIcon from '@mui/icons-material/FirstPage'
import LastPageIcon from '@mui/icons-material/LastPage'
import KeyboardArrowLeft from '@mui/icons-material/KeyboardArrowLeft'
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'

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

const MAX_SELECTED_ROWS = 10
const DEFAULT_PAGE_SIZE = 10

const TransactionsTable = () => {
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

  // Cache selected rows across pages for bulk update
  const [selectedRowCache, setSelectedRowCache] = useState<Record<string, any>>(
    {}
  )

  // Track manually deselected rows
  const manuallyDeselectedIdsRef = useRef<Set<string>>(new Set())
  const previousSelectionIdsRef = useRef<Set<string>>(new Set())

  const categories = useSelector((s: any) => selectAllCategories(s))

  const { sortModel, page, pageSize, setPage, setPageSize, handleSortChange } =
    useFetchSortedPaginatedData()

  // Force pageSize to 10 and prevent changes
  useEffect(() => {
    if (pageSize !== DEFAULT_PAGE_SIZE) {
      setPageSize(DEFAULT_PAGE_SIZE)
    }
  }, [pageSize, setPageSize])

  const queryParams = useMemo(
    () => ({
      page,
      page_size: DEFAULT_PAGE_SIZE, // Always use 10
      ordering: sortModel?.[0]?.field,
      sortOrder: sortModel?.[0]?.sort ?? undefined,
      is_paginated: true
    }),
    [page, sortModel]
  )

  const { data, isPending } = useFetchUncategorisedTransactions(queryParams, {
    enabled: !!accessToken
  })

  const rows = useMemo(() => data?.results ?? [], [data])

  const isSelectableRow = useCallback(
    (row: any) => {
      const idStr = String(row?.id ?? '')
      return (
        (!!row?.category && !!row?.type && !!row?.subtype) ||
        !!categories?.[idStr]
      )
    },
    [categories]
  )

  const handleOpenCategorise = useCallback(
    (row: any) => {
      const idStr = String(row?.id ?? '')
      const local = categories?.[idStr]

      if (local) {
        setModalInitial(local)
      } else if (row?.category && row?.type && row?.subtype) {
        setModalInitial({
          category: row.category,
          type: row.type,
          subtype: row.subtype,
          lineItem: row.expense_category
        })
      } else {
        setModalInitial(null)
      }

      setSelectedRow(row)
      setCategorisationOpen(true)
    },
    [categories]
  )

  const columns = useTransactionsColumns(categories, handleOpenCategorise)

  // ====================== SELECTION LOGIC ======================

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
      const normalized = normalizeSelection(newModel.ids ?? [])
      const nextIds = new Set(Array.from(normalized.ids).map(String))
      const prevIds = previousSelectionIdsRef.current

      for (const prevId of prevIds) {
        if (!nextIds.has(prevId)) {
          manuallyDeselectedIdsRef.current.add(prevId)
        }
      }
      for (const nextId of nextIds) {
        manuallyDeselectedIdsRef.current.delete(nextId)
      }

      previousSelectionIdsRef.current = nextIds
      setRowSelectionModel(normalized)
    },
    [normalizeSelection]
  )

  // Auto-select eligible rows on current page
  useEffect(() => {
    if (!rows.length || selectedCount >= MAX_SELECTED_ROWS) return

    setRowSelectionModel((prev) => {
      const currentSelected = new Set(Array.from(prev.ids).map(String))
      const nextSelected = [...Array.from(prev.ids)]

      for (const row of rows) {
        if (nextSelected.length >= MAX_SELECTED_ROWS) break

        const idStr = String(row.id)
        if (currentSelected.has(idStr)) continue
        if (manuallyDeselectedIdsRef.current.has(idStr)) continue
        if (!isSelectableRow(row)) continue

        nextSelected.push(row.id)
        currentSelected.add(idStr)
      }

      if (nextSelected.length === prev.ids.size) return prev

      const newModel = {
        type: 'include' as const,
        ids: new Set<GridRowId>(nextSelected)
      }

      previousSelectionIdsRef.current = new Set(nextSelected.map(String))
      return newModel
    })
  }, [rows, isSelectableRow, selectedCount])

  // Cache selected rows across pages
  useEffect(() => {
    const selectedIds = new Set(Array.from(rowSelectionModel.ids).map(String))

    setSelectedRowCache((prev) => {
      const nextCache: Record<string, any> = {}

      Object.keys(prev).forEach((id) => {
        if (selectedIds.has(id)) nextCache[id] = prev[id]
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

  // ====================== PAGINATION LOCK ======================
  // Locked as soon as any row is selected (per your requirement)
  const paginationLocked = selectedCount > 0 || isCategorising

  // ====================== HANDLERS ======================

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

  const handleUpdateAll = useCallback(async () => {
    if (isCategorising || selectedCount === 0) return

    const selectedIds = Array.from(rowSelectionModel.ids)

    const transactions = selectedIds
      .map((id) => {
        const idStr = String(id)
        const local = categories?.[idStr]
        const cachedRow = selectedRowCache[idStr]
        const currentRow = rows.find((r: any) => String(r.id) === idStr)
        const sourceRow = cachedRow ?? currentRow

        if (local?.category && local?.type && local?.subtype) {
          return {
            transaction_id: idStr,
            ...local,
            expense_category: local.lineItem ?? null,
            is_verified: true
          }
        }

        if (sourceRow?.category && sourceRow?.type && sourceRow?.subtype) {
          return {
            transaction_id: idStr,
            category: sourceRow.category,
            type: sourceRow.type,
            subtype: sourceRow.subtype,
            expense_category: sourceRow.expense_category ?? null,
            is_verified: true
          }
        }
        return null
      })
      .filter(Boolean)

    if (!transactions.length) {
      notify.error('No valid transactions to update.')
      return
    }

    try {
      setIsCategorising(true)
      await apiClient.post(
        endpoints.bankIntegrator.uncategorisedTransactionsUpdate(
          activePracticeId ?? ''
        ),
        { transactions }
      )

      // Reset after successful update
      dispatch(clearCategories())
      setRowSelectionModel({ type: 'include', ids: new Set() })
      setSelectedRowCache({})
      manuallyDeselectedIdsRef.current.clear()
      previousSelectionIdsRef.current.clear()

      notify.success('Transactions categorised successfully.')
    } catch (err) {
      console.error(err)
      notify.error('Bulk update failed.')
    } finally {
      setIsCategorising(false)
      queryClient.removeQueries({
        queryKey: ['uncategorisedTransactions']
      })
    }
  }, [
    rowSelectionModel,
    categories,
    selectedRowCache,
    rows,
    activePracticeId,
    dispatch,
    isCategorising,
    selectedCount
  ])

  const TablePaginationActions = useCallback(
    (props: {
      count: number
      page: number
      rowsPerPage: number
      onPageChange: (
        event: React.MouseEvent<HTMLButtonElement>,
        page: number
      ) => void
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
              ? 'Categorising...'
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
            isRowSelectable={(params) => isSelectableRow(params.row)}
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
          rowsPerPageOptions={[]} // Empty = hide dropdown
          onPageChange={(_, newPage) => setPage(newPage)}
          // Removed onRowsPerPageChange since it's now fixed
          ActionsComponent={TablePaginationActions}
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
