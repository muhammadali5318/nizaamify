import React, { useCallback, useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box
} from '@mui/material'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import { queryClient } from 'src/utils/queryClient'
import { formatChatDate } from 'src/utils/stringUtils'
import { useDispatch } from 'react-redux'
import { resetConversation } from 'src/store/slices/chatSlice'

interface Props {
  open: boolean
  onClose: () => void
  chatMetaData: any
  practiceId: string | null
  selectedChatId: string | null
}

const ConfirmDeleteChatModal: React.FC<Props> = ({
  open,
  onClose,
  chatMetaData,
  practiceId,
  selectedChatId
}) => {
  const [loading, setLoading] = useState(false)
  const dispatch = useDispatch()

  const handleDelete = useCallback(async () => {
    if (!practiceId) return

    setLoading(true)
    try {
      await apiClient.delete(
        endpoints.chatBot.chatsHistory(practiceId, chatMetaData.id)
      )
      await queryClient.invalidateQueries({ queryKey: ['fetchRecentChats'] })
      if (selectedChatId === chatMetaData?.id) {
        dispatch(resetConversation())
      }
      onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [practiceId, chatMetaData, onClose])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth='xs'
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: '24px'
          }
        }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Box
            component='img'
            src='/assets/trash-modal-icon.svg'
            alt='delete icon'
            sx={{ width: 42, height: 42 }}
          />
          <Typography
            className='font-weight--700'
            sx={{ typography: { xs: 'h6', sm: 'h5' } }}
          >
            Delete Chat
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ paddingBottom: 0 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography>
            Are you sure you want to delete the chat titled{' '}
            <strong>{chatMetaData.title}</strong>?
          </Typography>
          <Typography variant='caption' color='text.secondary'>
            Created on: {formatChatDate(chatMetaData.created_at)}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ gap: 1, p: 2 }}>
        <Button onClick={onClose} disabled={loading} variant='outlined'>
          Cancel
        </Button>
        <Button
          color='error'
          variant='contained'
          onClick={handleDelete}
          disabled={loading}
          loading={loading}
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ConfirmDeleteChatModal
