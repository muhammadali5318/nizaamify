import { useState, useCallback, useRef } from 'react'
import { useActivePractice } from 'src/hooks/useActivePractice'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import { v4 as uuid } from 'uuid'

export type Role = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: Role
  content: string
  isStreaming?: boolean
}

const THINKING_MESSAGES = [
  'Thinking...',
  'Still working on it, this is a deep one!',
  'Almost there, just putting on the finishing touches...'
]

const THINKING_INTERVAL = 2000 // ms
const SPINNER = '⏳ ' // can replace with ⏳ / 🔄 / ⏱️

export const useChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isSending, setIsSending] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const { activePracticeId } = useActivePractice()

  const abortControllerRef = useRef<AbortController | null>(null)
  const thinkingIntervalRef = useRef<number | null>(null)

  /* ---------------- helpers ---------------- */

  const clearThinkingInterval = () => {
    if (thinkingIntervalRef.current !== null) {
      window.clearInterval(thinkingIntervalRef.current)
      thinkingIntervalRef.current = null
    }
  }

  const startThinkingMessages = (assistantMessageId: string) => {
    let index = 0

    clearThinkingInterval()

    // show first message immediately with spinner
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === assistantMessageId
          ? {
              ...msg,
              content: `${SPINNER}${THINKING_MESSAGES[0]}`,
              isStreaming: true
            }
          : msg
      )
    )

    thinkingIntervalRef.current = window.setInterval(() => {
      index += 1
      if (index >= THINKING_MESSAGES.length) return

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: `${SPINNER}${THINKING_MESSAGES[index]}`,
                isStreaming: true
              }
            : msg
        )
      )
    }, THINKING_INTERVAL)
  }

  /* ---------------- API ---------------- */

  const sendMessage = useCallback(
    async (input: string) => {
      if (!input.trim() || isSending) return

      abortControllerRef.current?.abort()
      clearThinkingInterval()

      const controller = new AbortController()
      abortControllerRef.current = controller

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

      startThinkingMessages(assistantMessageId)
      setIsSending(true)

      try {
        const payload: Record<string, any> = {
          message: input,
          response_style: 'standard'
        }

        if (conversationId) {
          payload.conversation_id = conversationId
        }

        const res = await apiClient.post(
          endpoints.chatBot.chat(activePracticeId ?? ''),
          payload,
          { signal: controller.signal }
        )

        const data = res.data?.data
        const answer = data?.answer ?? 'No response received.'

        if (!conversationId && data?.conversation_id) {
          setConversationId(data.conversation_id)
        }

        clearThinkingInterval()

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: answer,
                  isStreaming: false
                }
              : msg
          )
        )
      } catch (error: any) {
        clearThinkingInterval()

        if (error?.name === 'AbortError' || error?.name === 'CanceledError') {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, isStreaming: false }
                : msg
            )
          )
          return
        }

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: 'Something went wrong. Please try again.',
                  isStreaming: false
                }
              : msg
          )
        )
      } finally {
        setIsSending(false)
        abortControllerRef.current = null
      }
    },
    [isSending, conversationId, activePracticeId]
  )

  /* ---------------- reset ---------------- */

  const resetConversation = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null

    clearThinkingInterval()

    setMessages([])
    setConversationId(null)
    setIsSending(false)
  }, [])

  return {
    messages,
    sendMessage,
    isSending,
    conversationId,
    resetConversation
  }
}
