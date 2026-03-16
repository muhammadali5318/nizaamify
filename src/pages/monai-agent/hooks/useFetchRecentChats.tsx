import { useInfiniteQuery } from '@tanstack/react-query'
import { useActivePractice } from 'src/hooks/useActivePractice'
import useUserDetails from 'src/hooks/useUserDetails'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'

export const useFetchRecentChatsInfinite = (
  enabled: boolean,
  pageSize = 20
) => {
  const { activePracticeId } = useActivePractice()
  const { isUserOwnerOrDirector } = useUserDetails()

  return useInfiniteQuery({
    queryKey: ['fetchRecentChats', activePracticeId, pageSize],

    queryFn: async ({ pageParam = 1 }) => {
      const res = await apiClient.get(
        endpoints.chatBot.recentChats(activePracticeId ?? ''),
        {
          params: {
            page: pageParam,
            page_size: pageSize
          }
        }
      )

      return res.data?.data ?? res.data
    },

    initialPageParam: 1,

    getNextPageParam: (lastPage, allPages) => {
      // API gives "next" when more pages exist
      if (lastPage?.next) {
        return allPages.length + 1
      }
      return undefined
    },

    enabled: enabled && !!activePracticeId && isUserOwnerOrDirector,
    staleTime: 0,
    refetchOnMount: 'always'
  })
}
