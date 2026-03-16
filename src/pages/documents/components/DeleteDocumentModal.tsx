import React, { JSX, useMemo } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography
} from '@mui/material'

interface DeleteDocumentModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  loading?: boolean
  document: {
    id: string
    name: string
  } | null
  title?: JSX.Element | string // optional custom title
  content?: JSX.Element // optional custom content
}

const DeleteDocumentModal: React.FC<DeleteDocumentModalProps> = ({
  open,
  onClose,
  onConfirm,
  loading = false,
  document,
  title,
  content
}) => {
  const isDisabled = useMemo(() => loading || !document, [loading, document])

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
            borderRadius: '24px'
          }
        }
      }}
    >
      <DialogTitle sx={{ p: 0 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Box
            component='img'
            src='/assets/trash-modal-icon.svg'
            alt=''
            sx={{ width: { xs: 48, sm: 64 }, height: { xs: 48, sm: 64 } }}
          />
          {title ? (
            typeof title === 'string' ? (
              <Typography
                className='font-weight--700'
                sx={{ typography: { xs: 'h6', sm: 'h5' } }}
              >
                {title}
              </Typography>
            ) : (
              title
            )
          ) : (
            <Typography
              className='font-weight--700'
              sx={{ typography: { xs: 'h6', sm: 'h5' } }}
            >
              Confirm Document Deletion
            </Typography>
          )}
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0, pt: 1 }}>
        {content ? (
          content
        ) : (
          <>
            <Typography variant='subtitle1'>
              Are you sure you want to delete the document{' '}
              <strong>{document?.name}</strong>?
            </Typography>

            <Typography variant='subtitle1' sx={{ mt: 1 }}>
              This will permanently remove the document and reverse all
              associated financial calculations recorded in the system.
            </Typography>

            <Typography variant='subtitle1' sx={{ mt: 1 }}>
              This action cannot be undone.
            </Typography>
          </>
        )}
      </DialogContent>

      <DialogActions
        sx={{
          p: 0,
          mt: 2.5,
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2
        }}
      >
        <Button
          onClick={onClose}
          variant='outlined'
          size='large'
          fullWidth
          disabled={loading}
        >
          Cancel
        </Button>

        <Button
          variant='contained'
          color='error'
          size='large'
          onClick={onConfirm}
          disabled={isDisabled}
          fullWidth
        >
          {loading ? 'Deleting...' : 'Delete Document'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default React.memo(DeleteDocumentModal)
