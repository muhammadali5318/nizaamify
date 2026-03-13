import React, { useCallback, useMemo, useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography
} from '@mui/material'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import { useAuth } from 'src/context/AuthProvider'
import { useActivePractice } from 'src/hooks/useActivePractice'
import { queryClient } from 'src/utils/queryClient'
import { notify } from 'src/components/notistack/NotificationProvider'

interface DeleteDocumentModalProps {
  open: boolean
  onClose: () => void
  document: {
    id: string
    name: string
  } | null
}

const DeleteDocumentModal: React.FC<DeleteDocumentModalProps> = ({
  open,
  onClose,
  document
}) => {
  const { accessToken } = useAuth()
  const { activePracticeId } = useActivePractice()
  const [loading, setLoading] = useState(false)

  const isDisabled = useMemo(
    () => loading || !document || !accessToken,
    [loading, document, accessToken]
  )

  const handleConfirm = useCallback(async () => {
    if (!document || !activePracticeId) return

    setLoading(true)
    try {
      await apiClient.delete(
        endpoints.documents.deleteDocument(activePracticeId, document.id),
        {
          params: {
            module: 'docs'
          }
        }
      )

      await queryClient.invalidateQueries({
        queryKey: ['uploadedDocumentListApi'],
        exact: false
      })
      await queryClient.invalidateQueries({
        queryKey: ['docs', 'counts']
      })

      onClose()
      notify.success('Selected document has been deleted successfully')
    } catch (error) {
      console.error('DeleteDocumentModal error:', error)
    } finally {
      setLoading(false)
    }
  }, [document, activePracticeId, onClose])

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
          <Typography
            className='font-weight--700'
            sx={{ typography: { xs: 'h6', sm: 'h5' } }}
          >
            Confirm Document Deletion
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0, pt: 1 }}>
        <Typography variant='subtitle1'>
          Are you sure you want to delete the document{' '}
          <strong>{document?.name}</strong>?
        </Typography>

        <Typography variant='subtitle1' sx={{ mt: 1 }}>
          This will permanently remove the document and reverse all associated
          financial calculations recorded in the system.
        </Typography>

        <Typography variant='subtitle1' sx={{ mt: 1 }}>
          This action cannot be undone.
        </Typography>
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
          onClick={handleConfirm}
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
