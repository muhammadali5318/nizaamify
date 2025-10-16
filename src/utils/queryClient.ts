// src/services/queryClient.ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 45, // 45 minutes fresh
      gcTime: 1000 * 60 * 60, // 60 minutes before inactive queries are GC'ed
      refetchOnWindowFocus: true, // keep data fresh when user returns
      refetchOnReconnect: true, // refetch when network comes back
      refetchOnMount: true, // don't refetch every mount (but will if stale)
      retry: 2
    }
  }
})
