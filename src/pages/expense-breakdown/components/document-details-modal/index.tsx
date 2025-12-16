import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Divider,
  IconButton
} from '@mui/material'

interface AddPaymentProps {
  open: boolean
  onClose: () => void
}

const DocumentDetailsModal: React.FC<AddPaymentProps> = React.memo(
  ({ open, onClose }) => {
    const documents = [
      {
        name: 'Payroll_Statement_Oct2025.pdf',
        size: 'Payroll_Statement_Oct2025(1.4MB)'
      },
      {
        name: 'Payroll_Statement_Oct2025.pdf',
        size: 'PDF(1.4MB)'
      },
      {
        name: 'Payroll_Statement_Oct2025.pdfPayroll_Statement_Oct2025.pdfPayroll_Statement_Oct2025.pdfPayroll_Statement_Oct2025.pdfPayroll_Statement_Oct2025.pdf',
        size: 'PDF(1.4MB)'
      },
      {
        name: 'Payroll_Statement_Oct2025.pdfPayroll_Statement_Oct2025.pdfPayroll_Statement_Oct2025.pdfPayroll_Statement_Oct2025.pdfPayroll_Statement_Oct2025.pdf',
        size: 'PDF(1.4MB)'
      }
    ]
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
              View the details of this uploaded document.
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
            {documents.map((doc, index) => (
              <React.Fragment key={index}>
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
                    title={doc.name}
                  >
                    {doc.name}
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
                      {doc.size}
                    </Typography>

                    <Divider
                      orientation='vertical'
                      flexItem
                      sx={{
                        height: 24,
                        alignSelf: 'center'
                      }}
                    />

                    <IconButton aria-label='download document' size='small'>
                      <img
                        src='/assets/document-download.svg'
                        alt='download'
                        style={{ width: 20, height: 20 }}
                      />
                    </IconButton>
                  </Box>
                </Box>

                {/* Add divider after every item EXCEPT the last one */}
                {index < documents.length - 1 && <Divider sx={{ my: 0 }} />}
              </React.Fragment>
            ))}

            {/* Optional: message when no documents */}
            {documents.length === 0 && (
              <Typography
                variant='body2'
                color='text.secondary'
                textAlign='center'
                py={4}
              >
                No documents uploaded.
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
