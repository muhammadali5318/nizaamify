// src/components/chat/ChatMessages.tsx
import { Box } from '@mui/material'
import { ChatMessage } from 'src/store/slices/chatSlice'
import ChatMessageBubble from './ChatMessageBubble'
import { useEffect, useRef } from 'react'

interface Props {
  messages: ChatMessage[]
}

const ChatMessages = ({ messages }: Props) => {
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    // Smooth scroll to bottom when new messages arrive
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <Box width='100%' maxWidth={900}>
      {messages.map((msg) => (
        <ChatMessageBubble key={msg.id} message={msg} />
      ))}
      {/* This empty div acts as a scroll anchor */}
      <div ref={bottomRef} style={{ height: '1px' }} />
    </Box>
  )
}

export default ChatMessages
