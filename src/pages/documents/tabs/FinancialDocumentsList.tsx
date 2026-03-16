// file: src/components/FinancialDocumentsList.tsx
import styles from './financialDocumentsList.module.scss'
import React, { useCallback, useMemo, useState } from 'react'
import { Box } from '@mui/material'
import PageHeader from 'src/components/page-header'
import AddPaymentDateModal from '../components/documents-list/AddPaymentDateModal'
import { usePendingDocsColumns } from '../hooks/usePendingDocsColumns'
import { useFetchSortedPaginatedData } from 'src/hooks/useFetchSortedData.'
import useFetchUploadedDocsList from '../hooks/useFetchUploadedDocsList'
import useFetchUploadedByList from '../hooks/useFetchUplodedByList'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import { notify } from 'src/components/notistack/NotificationProvider'
import FilterBar, { FilterState } from '../components/documents-list/FilterBar'
import DocumentsTable from '../components/documents-list/DocumentsTable'
import {
  fetchAndSaveFile,
  getFileNameFromUrl
} from 'src/utils/downloadFileUtils'
import { defaultFinancialDocumentsListFilters } from '../config/documentsConfig'
import { useActivePractice } from 'src/hooks/useActivePractice'
import { useHasPermission } from 'src/config/module-permissions'
import DeleteDocumentModal from '../components/DeleteDocumentModal'
import { queryClient } from 'src/utils/queryClient'

interface FinancialDocumentsListProps {
  title: string
  description: string
  icon: string
  isPendingDocments: boolean
}

const FinancialDocumentsList: React.FC<FinancialDocumentsListProps> = ({
  title,
  description,
  icon,
  isPendingDocments
}) => {
  const canViewDocuments = useHasPermission('data.upload_archive')
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedRow, setSelectedRow] = useState<{
    id: string
    name: string
  } | null>(null)
  const { activePracticeId } = useActivePractice()

  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [documentId, setDocumentId] = useState<string | null>(null)

  const [deleteLoading, setDeleteLoading] = useState(false)

  const handleDeleteConfirm = useCallback(async () => {
    if (!selectedRow || !activePracticeId) return

    setDeleteLoading(true)

    try {
      await apiClient.delete(
        endpoints.documents.deleteDocument(activePracticeId, selectedRow.id),
        {
          params: { module: 'docs' }
        }
      )

      await queryClient.invalidateQueries({
        queryKey: ['uploadedDocumentListApi'],
        exact: false
      })

      await queryClient.invalidateQueries({
        queryKey: ['docs', 'counts']
      })

      notify.success('Selected document has been deleted successfully')

      setIsDeleteOpen(false)
      setSelectedRow(null)
    } catch (error) {
      console.error('Delete error:', error)
      notify.error('Failed to delete document')
    } finally {
      setDeleteLoading(false)
    }
  }, [selectedRow, activePracticeId])

  // external hook: paging & sorting
  const { sortModel, page, pageSize, setPage, setPageSize, handleSortChange } =
    useFetchSortedPaginatedData()

  // Local UI state
  const [addDateModalOpen, setAddDateModalOpen] = useState(false)

  const [filters, setFilters] = useState<FilterState>(
    defaultFinancialDocumentsListFilters
  )

  const handleFilterChange = useCallback(
    (next: Partial<FilterState>) => {
      setFilters((prev) => ({ ...prev, ...next }))
      setPage(0)
    },
    [setPage]
  )

  // handlers used by columns
  const onView = useCallback((documentId: string) => {
    setDocumentId(documentId)
    setAddDateModalOpen(true)
  }, [])

  const onViewDownload = useCallback(
    async (id: string) => {
      setDownloadingId(id)
      try {
        const resp = await apiClient.get(
          endpoints.documents.downloaduploadedDocument(
            activePracticeId ?? '',
            id
          )
        )

        const fileUrl = resp?.data?.data
        if (!fileUrl) {
          notify.error('File not found.')
          return
        }

        await fetchAndSaveFile(
          fileUrl,
          getFileNameFromUrl(fileUrl) || undefined
        )
      } catch (error) {
        console.error('Download failed:', error)
        notify.error('Something went wrong, please try again.')
      } finally {
        setDownloadingId(null)
      }
    },
    [activePracticeId]
  )

  const handleDeleteIconClick = (row: any) => {
    setIsDeleteOpen(true)
    setSelectedRow({
      id: row.id,
      name: row.file_name
    })
  }

  const handlers = useMemo(
    () => ({ onView, onViewDownload, handleDeleteIconClick }),
    [onView, onViewDownload, handleDeleteIconClick]
  )

  const columns = usePendingDocsColumns(
    handlers,
    isPendingDocments,
    downloadingId
  )

  // --- derive ordering from sortModel (use first sort entry when server-side sorting) ---
  const orderingField =
    sortModel && sortModel.length > 0 ? sortModel[0].field : null
  const sortOrder =
    sortModel && sortModel.length > 0
      ? (sortModel[0].sort as 'asc' | 'desc')
      : null

  // --- Fetch uploaded documents using the hook ---
  const {
    items: fetchedItems,
    total,
    isFetching,
    isLoading
  } = useFetchUploadedDocsList(
    {
      page,
      pageSize,
      search: filters.searchKey || undefined,
      document_category: filters.categories.length
        ? filters.categories
        : undefined,
      user_name: filters.uploadedBy.length ? filters.uploadedBy : undefined,
      dateRange:
        filters.dateRange && (filters.dateRange.start || filters.dateRange.end)
          ? {
              from: filters.dateRange.start ?? null,
              to: filters.dateRange.end ?? null
            }
          : null,
      document_type: filters.docType ? [filters.docType] : undefined,
      document_subtype:
        filters.docSubtype && filters.docSubtype.length
          ? filters.docSubtype
          : undefined,
      ordering: orderingField ?? null,
      sortOrder: sortOrder ?? null,
      requires_review: isPendingDocments ? true : undefined
    },
    {
      enabled: canViewDocuments
    }
  )

  const { items: fetchedUploadedBy = [], isLoading: isUploadedByLoading } =
    useFetchUploadedByList({
      enabled: canViewDocuments
    })

  const getRowClassName = (params: any) =>
    params.row.status === 'Disabled' ? 'rowDisabled' : ''

  const clearFilters = useCallback(() => {
    setFilters(defaultFinancialDocumentsListFilters)
    setPage(0)
  }, [setPage])

  const isAnyFilterApplied = useMemo(() => {
    return (
      !!filters.searchKey?.trim() ||
      filters.categories.length > 0 ||
      filters.uploadedBy.length > 0 ||
      !!filters.dateRange.start ||
      !!filters.dateRange.end ||
      !!filters.docType ||
      (filters.docSubtype?.length ?? 0) > 0
    )
  }, [filters])

  return (
    <Box className={styles.moduleRoot}>
      <Box p={2}>
        <PageHeader
          title={title}
          description={description}
          logo={icon}
          isDividerVisible={false}
        />
      </Box>

      <FilterBar
        value={filters}
        onChange={handleFilterChange}
        uploadedByOptions={
          Array.isArray(fetchedUploadedBy) ? fetchedUploadedBy : []
        }
        isUploadedByLoading={isUploadedByLoading}
        onClearFilters={clearFilters}
      />

      <DocumentsTable
        rows={fetchedItems}
        columns={columns}
        getRowClassName={getRowClassName}
        page={page}
        pageSize={pageSize}
        setPage={setPage}
        setPageSize={setPageSize}
        sortModel={sortModel}
        onSortModelChange={handleSortChange}
        loading={isFetching || isLoading}
        totalCount={total}
        onClearFilters={clearFilters}
        searchKey={filters.searchKey}
        isAnyFilterApplied={isAnyFilterApplied}
        // isPendingDocments={isPendingDocments}
      />

      <AddPaymentDateModal
        open={addDateModalOpen}
        onClose={() => setAddDateModalOpen(false)}
        documentId={documentId ?? ''}
      />

      <DeleteDocumentModal
        open={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        loading={deleteLoading}
        document={selectedRow}
      />
    </Box>
  )
}

export default FinancialDocumentsList
