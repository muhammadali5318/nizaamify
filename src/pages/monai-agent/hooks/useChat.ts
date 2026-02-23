import { useCallback } from 'react'
import { unwrapResult } from '@reduxjs/toolkit'
import { useQueryClient } from '@tanstack/react-query'

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

import { useActivePractice } from 'src/hooks/useActivePractice'

export const useChat = () => {
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()
  const { activePracticeId } = useActivePractice()

  const messages = useAppSelector(selectMessages)
  const isSending = useAppSelector(selectIsSending)
  const conversationId = useAppSelector(selectConversationId)
  const isLoadingHistory = useAppSelector(selectIsLoadingHistory)

  /* ============================================================
     SEND MESSAGE
     - Dispatch Redux thunk
     - Invalidate recent chats query
     - Optimistically update sidebar
  ============================================================ */

  const handleSendMessage = useCallback(
    async (input: string) => {
      if (!input.trim() || isSending) return

      try {
        const action = await dispatch(sendMessage(input))
        const payload = unwrapResult(action) as {
          answer: string
          conversationId?: string
        }

        /* ---------------------------
           1️⃣ Invalidate recent chats
        ---------------------------- */
        queryClient.invalidateQueries({
          predicate: (query) =>
            Array.isArray(query.queryKey) &&
            query.queryKey[0] === 'fetchRecentChats'
        })

        /* ---------------------------
           2️⃣ Optimistic sidebar update
        ---------------------------- */
        if (payload?.conversationId && activePracticeId) {
          const newChatMeta = {
            id: payload.conversationId,
            title: input.slice(0, 60),
            last_message: payload.answer,
            updated_at: new Date().toISOString()
          }

          queryClient.setQueryData(
            ['fetchRecentChats', activePracticeId, 20],
            (oldData: any) => {
              if (!oldData) return oldData

              // Handle infinite query structure
              if (oldData.pages) {
                const pagesCopy = [...oldData.pages]

                if (pagesCopy[0]?.results) {
                  // Prevent duplicates
                  const exists = pagesCopy[0].results.some(
                    (item: any) => item.id === newChatMeta.id
                  )

                  if (!exists) {
                    pagesCopy[0] = {
                      ...pagesCopy[0],
                      results: [newChatMeta, ...pagesCopy[0].results]
                    }
                  }
                }

                return { ...oldData, pages: pagesCopy }
              }

              return oldData
            }
          )
        }
      } catch (error) {
        // Error already handled inside slice (assistant placeholder updated)
        console.error('Send message failed:', error)
      }
    },
    [dispatch, isSending, queryClient, activePracticeId]
  )

  /* ============================================================
     RESET CONVERSATION
  ============================================================ */

  const handleResetConversation = useCallback(() => {
    dispatch(resetConversation())
  }, [dispatch])

  /* ============================================================
     LOAD EXISTING CONVERSATION
  ============================================================ */

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
