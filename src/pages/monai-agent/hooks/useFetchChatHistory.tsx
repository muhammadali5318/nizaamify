import { useQuery } from '@tanstack/react-query'
import { useActivePractice } from 'src/hooks/useActivePractice'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'

export const useFetchChatHistory = (
  enabled: boolean,
  chatsHistoryId: string
) => {
  const { activePracticeId } = useActivePractice()

  return useQuery({
    queryKey: ['fetchChatHistory', activePracticeId, chatsHistoryId],
    queryFn: async () => {
      if (!activePracticeId || !chatsHistoryId) return null

      try {
        const { data } = await apiClient.get(
          endpoints.chatBot.chatsHistory(activePracticeId, chatsHistoryId)
        )
        return data?.data ?? null
      } catch (error: any) {
        if (error.response?.status === 404) {
          return null
        }
        throw error
      }
    },
    enabled: enabled && !!activePracticeId && !!chatsHistoryId,
    staleTime: 0,
    refetchOnMount: true
  })
}
