// src/components/chat/ChatShell.tsx
import {
  Box,
  Typography,
  useMediaQuery,
  useTheme,
  CircularProgress
} from '@mui/material'
import ChatHeader from './ChatHeader'
import ChatInput from './ChatInput'
import SuggestionGrid from '../suggestions/SuggestionGrid'
import ChatMessages from './ChatMessages'
import { useChat } from '../../hooks/useChat'
import { useEffect, useState } from 'react'

interface Props {
  selectedChatId: string | null
  onChatCreated: (id: string) => void
}

const ChatShell = ({ selectedChatId, onChatCreated }: Props) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [inputValue, setInputValue] = useState('')

  const {
    messages,
    sendMessage,
    isSending,
    conversationId,
    isLoadingHistory,
    loadConversation
  } = useChat()

  // When user selects a chat from sidebar, load it from Redux
  useEffect(() => {
    if (selectedChatId) {
      loadConversation(selectedChatId)
    } else {
      // if no selected chat, we keep current messages (or reset on New Chat)
      // resetConversation() is triggered by AiChatModule when New Chat is selected
    }
  }, [selectedChatId, loadConversation])

  useEffect(() => {
    if (selectedChatId === null && conversationId !== null) {
      onChatCreated(conversationId)
    }
  }, [conversationId, selectedChatId, onChatCreated])

  const handleSend = (text: string) => {
    if (!text.trim()) return
    sendMessage(text)
    setInputValue('')
  }

  const hasMessages = messages.length > 0

  // LOADING GUARD: Don't show "New Chat" suggestions while history is loading
  if (selectedChatId && isLoadingHistory) {
    return (
      <Box display='flex' flex={1} justifyContent='center' alignItems='center'>
        <CircularProgress sx={{ color: 'rgba(0,0,0,0.2)' }} />
      </Box>
    )
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        overflow: 'hidden'
      }}
    >
      <Box
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          px: isMobile ? 2 : 4,
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' }
        }}
      >
        {!hasMessages ? (
          <Box sx={{ my: 'auto', width: '100%', maxWidth: 850 }}>
            <ChatHeader />
            <Box
              sx={{
                mt: 4,
                p: isMobile ? 2 : 3,
                bgcolor: '#FFFFFF',
                borderRadius: '28px',
                border: '1px solid #EEEEEE',
                boxShadow: '0px 4px 12px rgba(0,0,0,0.03)',
                display: 'flex',
                flexDirection: 'column',
                gap: 2.5
              }}
            >
              <ChatInput
                value={inputValue}
                onChange={setInputValue}
                onSend={handleSend}
                disabled={isSending}
              />
              <Box display={'flex'} gap={1}>
                <img src='/assets/bulb.svg' alt='bulb img' />
                <Typography variant='subtitle1' fontWeight={700}>
                  Try asking:
                </Typography>
              </Box>
              <SuggestionGrid onSelect={handleSend} />
              <Box display={'flex'} justifyContent={'center'}>
                <Typography color='#6A7282' variant='caption'>
                  MonAi Agent can make mistakes. Please verify important
                  information.{' '}
                </Typography>
              </Box>
            </Box>
          </Box>
        ) : (
          <Box sx={{ width: '100%', maxWidth: 850, py: isMobile ? 2 : 4 }}>
            <ChatMessages messages={messages} />
          </Box>
        )}
      </Box>

      {hasMessages && (
        <Box
          sx={{
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            pb: isMobile ? 2 : 4,
            px: 2
          }}
        >
          <Box
            sx={{
              width: '100%',
              maxWidth: 850,
              p: 1.5,
              bgcolor: '#FFFFFF',
              borderRadius: '28px',
              border: '1px solid #EEEEEE',
              boxShadow: '0px -4px 20px rgba(0,0,0,0.04)'
            }}
          >
            <ChatInput
              value={inputValue}
              onChange={setInputValue}
              onSend={handleSend}
              disabled={isSending}
            />
          </Box>
        </Box>
      )}
    </Box>
  )
}

export default ChatShell
