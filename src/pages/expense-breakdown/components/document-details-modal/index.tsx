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

interface DocumentItem {
  file_name: string
  document_s3_path: string
  size?: string
}

interface DocumentDetailsModalProps {
  open: boolean
  onClose: () => void
  /**
   * Array of documents to render
   */
  downloadableDocuments: DocumentItem[]
  /**
   * Optional hook to get a presigned URL for a given s3 path.
   * If provided, it should return a fully-resolved URL (string).
   * e.g. async (s3Path) => { const r = await fetch(`/api/presign?path=${encodeURIComponent(s3Path)}`); return r.json().url; }
   */
  getPresignedUrl?: (s3Path: string) => Promise<string>
}

const DocumentDetailsModal: React.FC<DocumentDetailsModalProps> = React.memo(
  ({ open, onClose, downloadableDocuments, getPresignedUrl }) => {
    const [downloadingIndex, setDownloadingIndex] = useState<number | null>(
      null
    )
    const [error, setError] = useState<string | null>(null)

    const downloadFile = useCallback(
      async (s3Path: string, fileName?: string, index?: number) => {
        try {
          setError(null)
          if (typeof index === 'number') setDownloadingIndex(index)

          let url: string | null = null

          if (!url) url = s3Path

          // Attempt download: create an anchor and click it. This will open in a new tab if the resource is cross-origin.
          const a = document.createElement('a')
          a.href = url
          // only set download attribute for same-origin / direct file names (browsers may ignore cross-origin download attr)
          if (fileName) a.download = fileName
          a.target = '_blank'
          a.rel = 'noopener noreferrer'
          document.body.appendChild(a)
          a.click()
          a.remove()
        } catch (err: any) {
          console.error('download error', err)
          setError('Failed to download file. Please try again.')
        } finally {
          setDownloadingIndex(null)
        }
      },
      [getPresignedUrl]
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
                        onClick={() =>
                          downloadFile(
                            doc.document_s3_path,
                            doc.file_name,
                            index
                          )
                        }
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
                No documents uploaded.
              </Typography>
            )}

            {error && (
              <Typography
                variant='caption'
                color='error'
                textAlign='center'
                mt={1}
              >
                {error}
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
