// src/components/chat/ChatMessageBubble.tsx
import { Box, CircularProgress, Typography } from '@mui/material'
import { useEffect, useState } from 'react'
import { ChatMessage } from 'src/store/slices/chatSlice'
import MessageMarkdown from './MessageMarkdown'

interface Props {
  message: ChatMessage
}

const thinkingMessages = [
  'Processing your request...',
  'Generating response...',
  'Almost done, just a moment...',
  'Working on it...',
  'Preparing the answer...'
]

const ChatMessageBubble = ({ message }: Props) => {
  const isUser = message?.role.toLowerCase() === 'user'
  const [thinkingIndex, setThinkingIndex] = useState(0)

  useEffect(() => {
    if (!message.isStreaming) return

    const interval = setInterval(() => {
      setThinkingIndex((prev) => (prev + 1) % thinkingMessages.length)
    }, 3500)

    return () => clearInterval(interval)
  }, [message.isStreaming])

  return (
    <Box
      display='flex'
      justifyContent={isUser ? 'flex-end' : 'flex-start'}
      mb={2}
    >
      <Box
        maxWidth='75%'
        px={2}
        borderRadius={2}
        bgcolor={isUser ? 'primary.main' : 'grey.100'}
        color={isUser ? 'primary.contrastText' : 'text.primary'}
        display='flex'
        alignItems='center'
        gap={1}
      >
        {message.isStreaming ? (
          <>
            <CircularProgress size={18} />
            <Typography variant='body2' ml={1} py={1.5} fontStyle='italic'>
              {thinkingMessages[thinkingIndex]}
            </Typography>
          </>
        ) : (
          <Typography variant='body2' whiteSpace='pre-wrap'>
            <MessageMarkdown message={message?.content} />
          </Typography>
        )}
      </Box>
    </Box>
  )
}

export default ChatMessageBubble
