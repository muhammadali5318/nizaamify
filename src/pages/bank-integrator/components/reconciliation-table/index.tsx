// src/pages/reconciliation/ReconciliationTable.tsx

import { Box, TablePagination } from '@mui/material'
import { DataGrid, GridSortModel } from '@mui/x-data-grid'
import { useMemo, useState, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { NoResultsBox } from 'src/pages/team-management/team-members/components/TeamMembers'
import { teamMembersSx } from 'src/pages/team-management/team-management-config'
import { useReconciliationColumns } from '../../hooks/useReconciliationColumns'
import CategorisationModal from '../categorisation-modal'

import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import { queryClient } from 'src/utils/queryClient'
import { presignBankStatement } from 'src/services/apis/docsApi'

import useUserDetails from 'src/hooks/useUserDetails'
import { useActivePractice } from 'src/hooks/useActivePractice'

import { notify } from 'src/components/notistack/NotificationProvider'

import {
  setPresignFileData,
  setUploadingFile,
  clearUploadingFile
} from 'src/store/slices/reconciliationTabPresignDataSlice'
import InvoiceUploadModal from '../invoice-upload-modal'

type TransactionCategory = {
  category: string
  subtype: string
  type: string
  lineItem: string
  transaction_posting_date: string
}

interface ReconciliationTableProps {
  rows: any[]
  total: number
  loading?: boolean
  sortModel?: GridSortModel
  handleSortChange?: (model: GridSortModel) => void
  page?: number
  pageSize?: number
  setPage?: (p: number) => void
  setPageSize?: (s: number) => void
}

const ReconciliationTable = ({
  rows = [],
  total = 0,
  loading = false,
  sortModel = [],
  handleSortChange = () => {},
  page = 0,
  pageSize = 10,
  setPage = () => {},
  setPageSize = () => {}
}: ReconciliationTableProps) => {
  const dispatch = useDispatch()

  const { activePracticeId, accountingBasis } = useActivePractice()
  const { userId } = useUserDetails()

  // =============================
  // State
  // =============================

  const [categorisationOpen, setCategorisationOpen] = useState(false)
  const [confirmCategorisationOpen, setConfirmCategorisationOpen] =
    useState(false)
  const [selectedRow, setSelectedRow] = useState<any | null>(null)

  // =============================
  // Refs
  // =============================

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const fileRowRef = useRef<any | null>(null)

  // =============================
  // Redux selectors
  // =============================

  const presignFiles = useSelector(
    (state: any) => state.ReconciliationTabPresignData.presignFiles
  )

  // =============================
  // Categorisation handlers
  // =============================

  const handleOpenCategorise = () => {
    setCategorisationOpen(true)
  }

  const handleOpenConfirmCategorise = (row: any) => {
    setSelectedRow(row)
    setConfirmCategorisationOpen(true)
  }

  const handleCloseCategorise = () => {
    setSelectedRow(null)
    setCategorisationOpen(false)
    setConfirmCategorisationOpen(false)
  }

  const handleCloseConfirmCategorise = () => {
    setSelectedRow(null)
    setConfirmCategorisationOpen(false)
  }

  // =============================
  // Upload handlers
  // =============================

  const handleUploadFile = (row: any) => {
    fileRowRef.current = row
    fileInputRef.current?.click()
  }

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    const row = fileRowRef.current
    if (!row?.id) {
      notify.error('Row ID not found')
      return
    }
    const rowId = row.id

    try {
      // START loader
      dispatch(setUploadingFile(rowId))

      // Step 1 — get presigned URL
      const resp = await presignBankStatement(
        userId ?? '',
        [file],
        activePracticeId ?? ''
      )
      const item = resp?.data?.items?.[0]

      if (!item?.url) {
        throw new Error('Presigned URL not found')
      }

      // Step 2 — upload to S3
      await apiClient.put(item.url, file, {
        baseURL: '',
        headers: {
          'Content-Type': file.type,
          Authorization: undefined
        },
        transformRequest: [(data) => data]
      })

      if (accountingBasis === 'CASH') {
        try {
          const payload = {
            file_obj: {
              file_obj_key: item.key,
              file_size: file.size.toString(),
              file_type: file.type
            }
          }

          await apiClient.put(
            endpoints.bankIntegrator.uploadCategorisedTransactionsInvoice(
              activePracticeId ?? '',
              rowId
            ),
            payload
          )

          notify.success('Invoice uploaded successfully')
          await queryClient.invalidateQueries({
            queryKey: ['unverifiedTransactionsListApi']
          })
          return
        } catch (error) {
          console.error('Cash invoice upload failed:', error)
          notify.error('Invoice upload failed')
          return
        }
      }
      // Step 3 — save to redux
      dispatch(
        setPresignFileData({
          id: rowId,
          data: {
            s3Url: item.url,
            key: item.key,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size
          }
        })
      )

      notify.success('File uploaded successfully')
    } catch (error) {
      console.error(error)
      notify.error('File upload failed')
    } finally {
      // STOP loader
      dispatch(clearUploadingFile(rowId))

      event.target.value = ''
      fileRowRef.current = null
    }
  }

  // =============================
  // Save categorisation
  // =============================

  const handleSaveCategory = async (
    category: TransactionCategory,
    row?: { id: string }
  ) => {
    if (!row?.id) return

    const fileData = presignFiles[row.id]

    try {
      const payload: any = {
        is_verified: true,
        category: category.category,
        subtype: category.subtype,
        type: category.type,
        expense_category: category.lineItem,
        transaction_posting_date: category.transaction_posting_date
      }

      if (fileData) {
        const extension = fileData.fileName.split('.').pop() ?? ''

        payload.file_obj = {
          file_obj_key: fileData.key,
          file_size: String(fileData.fileSize ?? 0),
          file_type: extension
        }
      }

      await apiClient.put(
        endpoints.bankIntegrator.reconcileTransactions(
          activePracticeId ?? '',
          row.id
        ),
        payload
      )

      await queryClient.invalidateQueries({
        queryKey: ['unverifiedTransactionsListApi']
      })
      await queryClient.invalidateQueries({
        queryKey: ['transactionHistoryListApi']
      })

      notify.success('Category saved successfully')
    } catch (error) {
      console.error(error)
      notify.error('Failed to save category')
    }
  }

  // =============================
  // Columns
  // =============================

  const columns = useReconciliationColumns({
    onCategorise: handleOpenConfirmCategorise,
    handleUploadFile
  })

  const totalMinWidth = useMemo(() => {
    return columns.reduce((sum, col) => {
      const colMin = (col as any).minWidth ?? col.width ?? 120
      return sum + colMin
    }, 0)
  }, [columns])

  // =============================
  // Render
  // =============================

  return (
    <Box sx={{ width: '100%', maxWidth: '100vw', boxSizing: 'border-box' }}>
      {/* Hidden File Input */}
      <input
        type='file'
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

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
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          <DataGrid
            rows={rows}
            columns={columns}
            getRowId={(row) => row.id}
            disableColumnMenu
            disableColumnResize
            getRowHeight={() => 'auto'}
            hideFooter
            sortingMode='server'
            sortModel={sortModel}
            loading={loading}
            onSortModelChange={handleSortChange}
            sx={{
              ...teamMembersSx,
              width: '100%',
              minWidth: `${totalMinWidth}px`,
              boxSizing: 'border-box',
              '& .MuiDataGrid-virtualScroller': {
                overflowX: 'hidden'
              },
              '& .MuiDataGrid-cell': {
                py: 1
              }
            }}
            slots={{
              noRowsOverlay: () => (
                <NoResultsBox
                  loading={loading}
                  searchKey={''}
                  // eslint-disable-next-line no-console
                  onClear={() => console.log('cleared')}
                />
              )
            }}
          />
        </Box>
      </Box>

      {/* Pagination */}
      <TablePagination
        rowsPerPageOptions={[5, 10, 25, 50]}
        component='div'
        count={total}
        rowsPerPage={pageSize}
        page={page}
        onPageChange={(_, newPage) => setPage(newPage)}
        onRowsPerPageChange={(event) => {
          const newSize = parseInt(event.target.value, 10)
          setPageSize(newSize)
          setPage(0)
        }}
        showFirstButton
        showLastButton
      />

      {/* Modal */}
      <CategorisationModal
        open={categorisationOpen}
        onClose={handleCloseCategorise}
        onSave={handleSaveCategory}
        row={selectedRow}
      />

      <InvoiceUploadModal
        open={confirmCategorisationOpen}
        onClose={handleCloseConfirmCategorise}
        onConfirm={handleOpenCategorise}
      />
    </Box>
  )
}

export default ReconciliationTable
