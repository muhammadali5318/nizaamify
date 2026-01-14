import { useState, useCallback } from 'react'
import { v4 as uuid } from 'uuid'

export type Role = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: Role
  content: string
  isStreaming?: boolean
}

export const useChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isSending, setIsSending] = useState(false)

  const sendMessage = useCallback(async (input: string) => {
    if (!input.trim()) return

    const userMessage: ChatMessage = {
      id: uuid(),
      role: 'user',
      content: input
    }

    const assistantMessageId = uuid()

    setMessages((prev) => [
      ...prev,
      userMessage,
      {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        isStreaming: true
      }
    ])

    setIsSending(true)

    // 🔁 MOCK STREAMING (replace with real API)
    const fakeResponse =
      'This is a simulated response from the Monai Agent. It streams the response character by character to mimic real-time typing effect. Enjoy using the Monai Agent!'

    for (let i = 0; i < fakeResponse.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 20))

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: msg.content + fakeResponse[i] }
            : msg
        )
      )
    }

    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg
      )
    )

    setIsSending(false)
  }, [])

  return {
    messages,
    sendMessage,
    isSending
  }
}
