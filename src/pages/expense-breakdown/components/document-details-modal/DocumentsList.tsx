// DocumentsList.tsx
import React, { useState } from 'react'
import {
  Box,
  Typography,
  Divider,
  IconButton,
  CircularProgress,
  Button
} from '@mui/material'
import DeleteDocumentModal from 'src/pages/documents/components/DeleteDocumentModal'
import { notify } from 'src/components/notistack/NotificationProvider'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import { useActivePractice } from 'src/hooks/useActivePractice'
import { queryClient } from 'src/utils/queryClient'

interface DocumentsListProps {
  title: string
  docs: any[]
  downloadingKey: string | null
  listKey: string
  page?: number
  pageSize?: number
  total?: number
  onPageChange?: (page: number, pageSize: number) => void
  onDownload: (listKey: string, id: string, indexKey: string | number) => void
  closeParent: () => void
}

const DocumentsList: React.FC<DocumentsListProps> = ({
  title,
  docs,
  downloadingKey,
  listKey,
  page = 1,
  pageSize = 10,
  total = 0,
  onPageChange,
  onDownload,
  closeParent
}) => {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const { activePracticeId } = useActivePractice()

  const totalPages = Math.max(1, Math.ceil((total || 0) / (pageSize || 10)))

  // const handleDeleteClick = (doc: any) => {
  //   setSelectedDoc(doc)
  //   setIsDeleteOpen(true)
  // }

  const handleDeleteConfirm = async () => {
    if (!selectedDoc) return

    try {
      setLoading(true) // ← start loading

      await apiClient.delete(
        endpoints.documents.deleteDocument(
          activePracticeId ?? '',
          selectedDoc.document_id
        ),
        {
          params: { module: 'docs' }
        }
      )

      notify.success('Selected document has been deleted successfully')
      setIsDeleteOpen(false)
      setSelectedDoc(null)
      closeParent?.()
      await queryClient.invalidateQueries({
        queryKey: ['allExpenseBreakDown']
      })
    } catch (error) {
      console.error('Delete error:', error)
      notify.error('Failed to delete document')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 260,
        borderRadius: '12px',
        background: 'var(--grey-50, #fafafa)',
        padding: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 1
      }}
    >
      <Typography variant='subtitle1' fontWeight={700} sx={{ px: 1 }}>
        {title}
      </Typography>

      <Divider sx={{ mx: 1 }} />

      {docs && docs.length > 0 ? (
        docs.map((doc, index) => (
          <React.Fragment key={`${listKey}-${doc.document_s3_path}-${index}`}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                minWidth: 0,
                px: 1,
                py: 0.5
              }}
            >
              <Typography
                variant='body2'
                sx={{
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
                title={doc.file_name}
              >
                {doc.file_name}
              </Typography>

              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  flexShrink: 0
                }}
              >
                <Typography
                  variant='body2'
                  fontWeight={700}
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  £{doc?.amount_decimal}
                </Typography>

                <Divider orientation='vertical' flexItem sx={{ height: 24 }} />

                <IconButton
                  size='small'
                  onClick={() => onDownload(listKey, doc.document_id, index)}
                >
                  {downloadingKey === `${listKey}-${index}` ? (
                    <CircularProgress size={18} />
                  ) : (
                    <img
                      src='/assets/document-download.svg'
                      alt='download'
                      style={{ width: 20, height: 20 }}
                    />
                  )}
                </IconButton>

                {/* <IconButton
                  size='small'
                  aria-label={`delete ${doc.file_name}`}
                  onClick={() => handleDeleteClick(doc)}
                >
                  <img
                    src='/assets/active-trash.svg'
                    alt='delete'
                    style={{ width: 20, height: 20, display: 'block' }}
                  />
                </IconButton> */}
              </Box>
            </Box>

            {index < docs.length - 1 && <Divider />}
          </React.Fragment>
        ))
      ) : (
        <Typography
          variant='body2'
          color='text.secondary'
          textAlign='center'
          py={4}
        >
          No items found.
        </Typography>
      )}

      {/* Pagination */}
      {/* Pagination */}
      {docs && docs.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pt: 1,
            px: 1
          }}
        >
          <Box>
            <Button
              size='small'
              disabled={!onPageChange || page <= 1}
              onClick={() =>
                onPageChange && onPageChange(Math.max(1, page - 1), pageSize)
              }
            >
              Prev
            </Button>

            <Button
              size='small'
              disabled={!onPageChange || page >= totalPages}
              onClick={() =>
                onPageChange &&
                onPageChange(Math.min(totalPages, page + 1), pageSize)
              }
            >
              Next
            </Button>
          </Box>

          <Typography variant='caption'>
            Page {page} of {totalPages}
          </Typography>
        </Box>
      )}

      {/* Delete Modal */}
      <DeleteDocumentModal
        open={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        loading={loading} // ← pass loading state
        document={selectedDoc}
      />
    </Box>
  )
}

export default DocumentsList
