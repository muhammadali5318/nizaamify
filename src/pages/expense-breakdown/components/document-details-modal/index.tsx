import React, { useState, useCallback } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Divider,
  IconButton,
  CircularProgress
} from '@mui/material'
import { notify } from 'src/components/notistack/NotificationProvider'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import {
  fetchAndSaveFile,
  getFileNameFromUrl
} from 'src/utils/downloadFileUtils'
import { useActivePractice } from 'src/hooks/useActivePractice'

interface DocumentItem {
  document_id: string
  file_name: string
  document_s3_path: string
  size?: string
}

interface DocumentDetailsModalProps {
  open: boolean
  onClose: () => void
  downloadableDocuments: DocumentItem[]
}

const DocumentDetailsModal: React.FC<DocumentDetailsModalProps> = React.memo(
  ({ open, onClose, downloadableDocuments }) => {
    const { activePracticeId } = useActivePractice()
    const [downloadingIndex, setDownloadingIndex] = useState<number | null>(
      null
    )
    const downloadFile = useCallback(
      async (id: string, index: number) => {
        setDownloadingIndex(index)
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
          setDownloadingIndex(null)
        }
      },
      [activePracticeId]
    )

    return (
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth='sm'
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
            <img
              src='/assets/doc-green.svg'
              alt='document icon'
              style={{ width: 64, height: 64 }}
            />
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
        </DialogTitle>

        <DialogContent sx={{ p: 0, pt: 3 }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              borderRadius: '12px',
              background: 'var(--grey-50, #fafafa)',
              padding: '10px'
            }}
          >
            {downloadableDocuments && downloadableDocuments.length > 0 ? (
              downloadableDocuments.map((doc, index) => (
                <React.Fragment key={doc.document_s3_path + index}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 2,
                      minWidth: 0
                    }}
                  >
                    {/* File Name - truncates with ellipsis */}
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

                    {/* Size + Divider + Download Button */}
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
                        {doc.size ?? ''}
                      </Typography>

                      <Divider
                        orientation='vertical'
                        flexItem
                        sx={{
                          height: 24,
                          alignSelf: 'center'
                        }}
                      />

                      <IconButton
                        aria-label='download document'
                        onClick={() => downloadFile(doc.document_id, index)}
                        size='small'
                      >
                        {downloadingIndex === index ? (
                          <CircularProgress size={18} />
                        ) : (
                          <img
                            src='/assets/document-download.svg'
                            alt='download'
                            style={{ width: 20, height: 20 }}
                          />
                        )}
                      </IconButton>
                    </Box>
                  </Box>

                  {/* Add divider after every item EXCEPT the last one */}
                  {index < downloadableDocuments.length - 1 && (
                    <Divider sx={{ my: 0 }} />
                  )}
                </React.Fragment>
              ))
            ) : (
              <Typography
                variant='body2'
                color='text.secondary'
                textAlign='center'
                py={4}
              >
                No documents were found for the selected category.{' '}
              </Typography>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 0, mt: 4 }}>
          <Button variant='outlined' onClick={onClose} fullWidth size='large'>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    )
  }
)

DocumentDetailsModal.displayName = 'DocumentDetailsModal'

export default DocumentDetailsModal
