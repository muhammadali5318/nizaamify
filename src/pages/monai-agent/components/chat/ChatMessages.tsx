import { Box } from '@mui/material'
import { ChatMessage } from '../../hooks/useChat'
import ChatMessageBubble from './ChatMessageBubble'
import { useEffect, useRef } from 'react'

interface Props {
  messages: ChatMessage[]
}

const ChatMessages = ({ messages }: Props) => {
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <Box flex={1} width='100%' maxWidth={900} overflow='auto' px={2} py={3}>
      {messages.map((msg) => (
        <ChatMessageBubble key={msg.id} message={msg} />
      ))}

      <div ref={bottomRef} />
    </Box>
  )
}

export default ChatMessages
