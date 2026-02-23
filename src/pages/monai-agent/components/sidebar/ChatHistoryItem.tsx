import { useState, useRef, useEffect } from 'react'
import {
  Box,
  ListItemButton,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  TextField,
  CircularProgress
} from '@mui/material'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { formatChatDate } from 'src/utils/stringUtils'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import { useActivePractice } from 'src/hooks/useActivePractice'
import { queryClient } from 'src/utils/queryClient'
import { notify } from 'src/components/notistack/NotificationProvider'
import ConfirmDeleteChatModal from '../delete-chat-modal'

interface Props {
  chatMetaData: any
  onClick: () => void
  selected?: boolean
  selectedChatId: string | null
}

const ChatHistoryItem = ({
  chatMetaData,
  selected,
  onClick,
  selectedChatId
}: Props) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const open = Boolean(anchorEl)
  const { activePracticeId } = useActivePractice()

  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(chatMetaData?.title || '')
  const [loading, setLoading] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing])

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation()
    setAnchorEl(event.currentTarget)
  }

  // Close the menu (matches MUI MenuProps type)
  const handleMenuClose = (
    event: object | React.SyntheticEvent,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _reason?: 'backdropClick' | 'escapeKeyDown'
  ) => {
    // If the event is a MouseEvent, stop propagation
    if (event && 'stopPropagation' in event) {
      ;(event as React.MouseEvent).stopPropagation()
    }
    setAnchorEl(null)
  }

  // Rename chat clicked from menu
  const handleRenameChat = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation()
    // Close menu using the rewritten handler
    handleMenuClose(event, 'backdropClick')
    setIsEditing(true)
  }

  const handleRenameSubmit = async () => {
    if (title.trim() === '') return

    setLoading(true)
    try {
      await apiClient.put(
        endpoints.chatBot.chatsHistory(
          activePracticeId ?? '',
          chatMetaData?.id
        ),
        {
          title: title.slice(0, 30)
        }
      )

      await queryClient.invalidateQueries({
        queryKey: ['fetchRecentChats']
      })
    } catch {
      notify.error(
        'An error occurred while updating the title. Please try again.'
      )
    } finally {
      setLoading(false)
      setIsEditing(false)
    }
  }

  // Delete chat clicked from menu
  const handleDeleteClicked = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation()
    handleMenuClose(event, 'backdropClick')
    setShowDeleteModal(true)
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    event.stopPropagation()
    if (event.key === 'Enter') handleRenameSubmit()
    if (event.key === 'Escape') {
      setTitle(chatMetaData?.title)
      setIsEditing(false)
    }
  }

  const handleBlur = () => {
    setTitle(chatMetaData?.title || '')
    setIsEditing(false)
  }

  return (
    <>
      <ListItemButton
        onClick={!isEditing ? onClick : undefined}
        selected={!isEditing && selected}
        sx={{
          p: '8px 8px 8px 16px',
          mb: '4px',
          borderRadius: '12px',
          border: '1px solid transparent',
          backgroundColor: 'transparent',
          '&.Mui-selected': {
            border: '1px solid #E0E0E0',
            backgroundColor: '#E0E0E0'
          },
          '&.Mui-focusVisible': {
            backgroundColor: 'transparent',
            border: '1px solid transparent'
          }
        }}
      >
        <Box
          sx={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1
          }}
        >
          <Box sx={{ overflow: 'hidden', flex: 1 }}>
            {isEditing ? (
              <TextField
                inputRef={inputRef}
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 30))}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
                onBlur={handleBlur}
                variant='standard'
                fullWidth
                size='small'
              />
            ) : (
              <Typography variant='subtitle2' fontWeight={500} noWrap>
                {title || 'No title'}
              </Typography>
            )}

            {!isEditing && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <img
                  src='/assets/clock.svg'
                  alt='clock icon'
                  width={14}
                  height={14}
                />
                <Typography mt={0.2} variant='caption' color='text.secondary'>
                  {formatChatDate(chatMetaData?.created_at)}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Menu or Spinner */}
          {isEditing ? (
            loading ? (
              <CircularProgress size={18} />
            ) : (
              <IconButton
                size='small'
                onClick={(e) => {
                  e.stopPropagation()
                  handleRenameSubmit()
                }}
              >
                <EditIcon fontSize='small' />
              </IconButton>
            )
          ) : (
            <IconButton size='small' onClick={handleMenuOpen}>
              <MoreVertIcon fontSize='small' />
            </IconButton>
          )}
        </Box>
      </ListItemButton>

      {/* Menu */}
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleMenuClose}
        onClick={(e) => e.stopPropagation()}
      >
        <MenuItem onClick={handleRenameChat}>
          <ListItemIcon>
            <EditIcon fontSize='small' />
          </ListItemIcon>
          <ListItemText>Rename chat</ListItemText>
        </MenuItem>

        <MenuItem onClick={handleDeleteClicked}>
          <ListItemIcon>
            <DeleteIcon fontSize='small' />
          </ListItemIcon>
          <ListItemText>Delete chat</ListItemText>
        </MenuItem>
      </Menu>

      <ConfirmDeleteChatModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        chatMetaData={chatMetaData}
        practiceId={activePracticeId}
        selectedChatId={selectedChatId}
      />
    </>
  )
}

export default ChatHistoryItem
