// utils/queryHelpers.ts
import { queryClient } from './queryClient'

export const removeAllQueriesExceptExact = (
  keepQueryKeys: Array<unknown[]>
) => {
  const keepSet = new Set(keepQueryKeys.map((k) => JSON.stringify(k)))

  queryClient
    .getQueryCache()
    .getAll()
    .forEach((query) => {
      const qk = query.queryKey

      if (!keepSet.has(JSON.stringify(qk))) {
        queryClient.removeQueries({
          queryKey: qk,
          exact: true
        })
      }
    })
}
