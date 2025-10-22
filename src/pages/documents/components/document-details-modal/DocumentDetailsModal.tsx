import React, { useCallback } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  Divider
} from '@mui/material'
import styles from './DocumentDetailsModal.module.scss'

interface DocumentDetailsModalProps {
  open: boolean
  onClose: () => void
  onDownload: () => void
  loading?: boolean
}

const DocumentDetailsModal: React.FC<DocumentDetailsModalProps> = React.memo(
  ({ open, onClose, onDownload, loading = false }) => {
    const handleClose = useCallback(() => {
      onClose()
    }, [onClose])

    return (
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth='sm'
        fullWidth
        slotProps={{
          paper: {
            sx: {
              py: '36px',
              px: { xs: 2, sm: 6 },
              borderRadius: '24px'
            }
          }
        }}
      >
        <DialogTitle sx={{ p: 0, mb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <img
              src='/assets/doc-green.svg'
              alt='user invitation icon'
              style={{ width: 64, height: 64 }}
            />
            <Typography
              className='font-weight--700'
              sx={{ typography: { xs: 'h6', sm: 'h5' } }}
            >
              Document details{' '}
            </Typography>
            <Typography variant='subtitle1' color='text.primary'>
              View the details of this uploaded document.
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 0, pt: 1, gap: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box className={styles.contentRoot}>
              <Box
                display={'flex'}
                flexDirection={'column'}
                gap={1}
                width={'100%'}
              >
                <Box display={'flex'} justifyContent={'space-between'} gap={1}>
                  <Typography variant='body2'>Document name: </Typography>
                  <Typography variant='body2' fontWeight={700}>
                    Annual financial report 2023
                  </Typography>
                </Box>
                <Divider />
                <Box display={'flex'} justifyContent={'space-between'} gap={1}>
                  <Typography variant='body2'>Document Type: </Typography>
                  <Typography variant='body2' fontWeight={700}>
                    Income & revenue
                  </Typography>
                </Box>
                <Divider />

                <Box display={'flex'} justifyContent={'space-between'} gap={1}>
                  <Typography variant='body2'>Subtype: </Typography>
                  <Typography variant='body2' fontWeight={700}>
                    Bank statements{' '}
                  </Typography>
                </Box>
                <Divider />
                <Box display={'flex'} justifyContent={'space-between'} gap={1}>
                  <Typography variant='body2'>Document date: </Typography>
                  <Typography variant='body2' fontWeight={700}>
                    07/22/2023
                  </Typography>
                </Box>
                <Divider />
                <Box display={'flex'} justifyContent={'space-between'} gap={1}>
                  <Typography variant='body2'>Uploaded By: </Typography>
                  <Typography variant='body2' fontWeight={700}>
                    John Doe
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 0, mt: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, width: '100%' }}>
            <Button
              variant='outlined'
              onClick={handleClose}
              disabled={loading}
              fullWidth
              size='large'
            >
              Close
            </Button>

            <Button
              onClick={() => onDownload()}
              variant='contained'
              disabled={loading}
              fullWidth
              size='large'
              startIcon={loading ? <CircularProgress size={16} /> : null}
              sx={{
                bgcolor: 'black',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' }
              }}
            >
              {loading ? 'Downloading...' : 'Download document'}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    )
  }
)

DocumentDetailsModal.displayName = 'DocumentDetailsModal'

export default DocumentDetailsModal
