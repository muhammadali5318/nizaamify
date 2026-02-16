import { useCallback } from 'react'
import { useAppDispatch, useAppSelector } from 'src/store/hooks'
import {
  sendMessage,
  resetConversation,
  fetchConversationHistory,
  selectMessages,
  selectIsSending,
  selectConversationId,
  selectIsLoadingHistory
} from 'src/store/slices/chatSlice'

export const useChat = () => {
  const dispatch = useAppDispatch()

  const messages = useAppSelector(selectMessages)
  const isSending = useAppSelector(selectIsSending)
  const conversationId = useAppSelector(selectConversationId)
  const isLoadingHistory = useAppSelector(selectIsLoadingHistory)

  const handleSendMessage = useCallback(
    (input: string) => {
      if (!input.trim() || isSending) return
      dispatch(sendMessage(input))
    },
    [dispatch, isSending]
  )

  const handleResetConversation = useCallback(() => {
    dispatch(resetConversation())
  }, [dispatch])

  const handleLoadConversation = useCallback(
    (id: string) => {
      dispatch(fetchConversationHistory(id))
    },
    [dispatch]
  )

  return {
    messages,
    sendMessage: handleSendMessage,
    isSending,
    conversationId,
    isLoadingHistory,
    resetConversation: handleResetConversation,
    loadConversation: handleLoadConversation
  }
}
