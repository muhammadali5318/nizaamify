import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import { v4 as uuid } from 'uuid'
import { RootState } from '../store'

export type Role = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: Role
  content: string
  isStreaming?: boolean
  created_at?: string
}

interface ChatState {
  messages: ChatMessage[]
  isSending: boolean
  isLoadingHistory: boolean
  conversationId: string | null
}

const initialState: ChatState = {
  messages: [],
  isSending: false,
  isLoadingHistory: false,
  conversationId: null
}

/* ============================================================
   FETCH HISTORY (Redux Controlled)
============================================================ */

export const fetchConversationHistory = createAsyncThunk<
  { messages: ChatMessage[]; id: string },
  string,
  { state: RootState }
>('chat/fetchConversationHistory', async (conversationId, { getState }) => {
  const state = getState()
  const activePracticeId =
    state.activePractice?.id ?? (state as any).activePracticeId

  const res = await apiClient.get(
    endpoints.chatBot.chatsHistory(activePracticeId ?? '', conversationId)
  )

  const rawHistory = res.data?.data ?? []

  // map to ChatMessage[]
  const messages: ChatMessage[] = rawHistory.map((m: any) => ({
    id: m.id ?? uuid(),
    role: m.role,
    content: m.content,
    created_at: m.created_at
  }))

  return {
    id: conversationId,
    messages
  }
})
/* ============================================================
   SEND MESSAGE
============================================================ */

export const sendMessage = createAsyncThunk<
  { answer: string; conversationId?: string },
  string,
  { state: RootState }
>('chat/sendMessage', async (input, { getState }) => {
  const state = getState()
  const activePracticeId =
    state.activePractice?.id ?? (state as any).activePracticeId

  const currentConvId = state.chat.conversationId

  const payload: Record<string, any> = {
    message: input,
    response_style: 'standard'
  }

  if (currentConvId) {
    payload.conversation_id = currentConvId
  }

  const res = await apiClient.post(
    endpoints.chatBot.chat(activePracticeId ?? ''),
    payload
  )

  const data = res.data?.data

  return {
    answer: data?.answer ?? 'No response received.',
    conversationId: data?.conversation_id
  }
})

/* ============================================================
   SLICE
============================================================ */

const slice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    resetConversation(state) {
      state.messages = []
      state.conversationId = null
      state.isSending = false
    }
  },
  extraReducers: (builder) => {
    builder

      /* ================= HISTORY ================= */

      .addCase(fetchConversationHistory.pending, (state) => {
        state.isLoadingHistory = true
        state.messages = []
      })

      .addCase(fetchConversationHistory.fulfilled, (state, action) => {
        state.isLoadingHistory = false
        state.messages = action.payload.messages
        state.conversationId = action.payload.id
      })

      .addCase(fetchConversationHistory.rejected, (state) => {
        state.isLoadingHistory = false
      })

      /* ================= SEND ================= */

      .addCase(sendMessage.pending, (state, action) => {
        const userMessage: ChatMessage = {
          id: uuid(),
          role: 'user',
          content: action.meta.arg
        }

        const assistantPlaceholder: ChatMessage = {
          id: uuid(),
          role: 'assistant',
          content: '',
          isStreaming: true
        }

        state.messages.push(userMessage)
        state.messages.push(assistantPlaceholder)
        state.isSending = true
      })

      .addCase(sendMessage.fulfilled, (state, action) => {
        const lastAssistant = [...state.messages]
          .reverse()
          .find((m) => m.role === 'assistant' && m.isStreaming)

        if (lastAssistant) {
          lastAssistant.content = action.payload.answer
          lastAssistant.isStreaming = false
        }

        if (!state.conversationId && action.payload.conversationId) {
          state.conversationId = action.payload.conversationId
        }

        state.isSending = false
      })

      .addCase(sendMessage.rejected, (state) => {
        const lastAssistant = [...state.messages]
          .reverse()
          .find((m) => m.role === 'assistant' && m.isStreaming)

        if (lastAssistant) {
          lastAssistant.content = 'Something went wrong. Please try again.'
          lastAssistant.isStreaming = false
        }

        state.isSending = false
      })
  }
})

export const { resetConversation } = slice.actions
export default slice.reducer

/* ============================================================
   SELECTORS
============================================================ */

export const selectMessages = (s: RootState) => s.chat.messages
export const selectIsSending = (s: RootState) => s.chat.isSending
export const selectIsLoadingHistory = (s: RootState) => s.chat.isLoadingHistory
export const selectConversationId = (s: RootState) => s.chat.conversationId
