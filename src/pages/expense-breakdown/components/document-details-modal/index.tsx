import React, { useState, useCallback } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton
} from '@mui/material'
import { notify } from 'src/components/notistack/NotificationProvider'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import {
  fetchAndSaveFile,
  getFileNameFromUrl
} from 'src/utils/downloadFileUtils'
import { useActivePractice } from 'src/hooks/useActivePractice'
import ManualListColumn from './ListManualEntries'
import CloseIcon from '@mui/icons-material/Close'
import DocumentsList from './DocumentsList'

interface DocumentItem {
  document_id: string
  file_name: string
  document_s3_path: string
  file_size: number
}

interface DocumentDetailsModalProps {
  open: boolean
  onClose: () => void

  // three lists + pagination metadata
  documents: DocumentItem[]
  documentsPage?: number
  documentsPageSize?: number
  documentsTotal?: number

  // manual entries have a different shape (array of entries with supporting_docs)
  manualEntries: any[]
  manualPage?: number
  manualPageSize?: number
  manualTotal?: number

  aggregators: DocumentItem[]
  aggregatorPage?: number
  aggregatorPageSize?: number
  aggregatorTotal?: number

  // callbacks when modal requests a different page
  onFetchDocumentsPage?: (page: number, pageSize: number) => void
  onFetchManualPage?: (page: number, pageSize: number) => void
  onFetchAggregatorPage?: (page: number, pageSize: number) => void
}

const DocumentDetailsModal: React.FC<DocumentDetailsModalProps> = React.memo(
  ({
    open,
    onClose,
    documents = [],
    documentsPage = 1,
    documentsPageSize = 10,
    documentsTotal = 0,

    manualEntries = [],
    manualPage = 1,
    manualPageSize = 10,
    manualTotal = 0,

    aggregators = [],
    aggregatorPage = 1,
    aggregatorPageSize = 10,
    aggregatorTotal = 0,

    onFetchDocumentsPage,
    onFetchManualPage,
    onFetchAggregatorPage
  }) => {
    const { activePracticeId } = useActivePractice()
    const [downloadingKey, setDownloadingKey] = useState<string | null>(null)

    const downloadFile = useCallback(
      async (listKey: string, id: string, indexKey: string | number) => {
        const key = `${listKey}-${indexKey}`
        setDownloadingKey(key)
        try {
          // For manual entries we receive file_obj_key as the s3 path. Backend's download endpoint
          // expects the identifier the same way as regular documents; we pass through whatever
          // identifier we received (document_id or file_obj_key).
          const resp = await apiClient.get(
            endpoints.documents.downloaduploadedDocument(
              activePracticeId ?? '',
              id
            ),
            {
              params: {
                module: listKey
              }
            }
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
          setDownloadingKey(null)
        }
      },
      [activePracticeId]
    )

    return (
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth='xl'
        fullWidth
        slotProps={{
          paper: {
            sx: {
              py: '36px',
              px: { xs: 2, sm: 6 },
              borderRadius: '24px',
              overflow: 'visible'
            }
          }
        }}
      >
        <DialogTitle sx={{ p: 0, mb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                width: '100%'
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2
                }}
              >
                <img
                  src='/assets/doc-green.svg'
                  alt='document icon'
                  style={{ width: 64, height: 64 }}
                />

                <Box>
                  <Typography
                    className='font-weight--700'
                    sx={{ typography: { xs: 'h6', sm: 'h5' } }}
                  >
                    Document Details
                  </Typography>
                  <Typography variant='subtitle1' color='text.primary'>
                    View the details of uploaded documents.
                  </Typography>
                </Box>
              </Box>
              <IconButton onClick={onClose}>
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 0, pt: 3 }}>
          {/* Container for three horizontal lists. Responsive: column on xs, row on md+ */}
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              flexDirection: { xs: 'column', md: 'row' },
              alignItems: 'stretch'
            }}
          >
            <DocumentsList
              title='Document List'
              docs={documents}
              downloadingKey={downloadingKey}
              listKey={'docs'}
              page={documentsPage}
              pageSize={documentsPageSize}
              total={documentsTotal}
              onPageChange={onFetchDocumentsPage}
              onDownload={downloadFile}
              closeParent={onClose}
            />

            <ManualListColumn
              title='Manual Entries'
              docs={manualEntries}
              downloadingKey={downloadingKey}
              listKey='manual'
              page={manualPage}
              pageSize={manualPageSize}
              total={manualTotal}
              onPageChange={onFetchManualPage}
              onDownload={downloadFile}
              closeParent={onClose}
            />

            <ManualListColumn
              title='Bank Connector'
              docs={aggregators}
              downloadingKey={downloadingKey}
              listKey={'docs'}
              page={aggregatorPage}
              pageSize={aggregatorPageSize}
              total={aggregatorTotal}
              onPageChange={onFetchAggregatorPage}
              onDownload={downloadFile}
              closeParent={onClose}
            />
          </Box>
        </DialogContent>
      </Dialog>
    )
  }
)

DocumentDetailsModal.displayName = 'DocumentDetailsModal'

export default DocumentDetailsModal
