import { QueryCache, QueryClient } from '@tanstack/react-query'
import { qk } from './query-keys'
import { trimInactiveRequestPayloads } from './request-cache-updates'

export function createQueryClient(): QueryClient {
  const client = new QueryClient({
    queryCache: new QueryCache({
      onSuccess: (_data, query) => {
        if (query.queryKey[0] === qk.requestPayloadsRoot[0]) trimInactiveRequestPayloads(client)
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    },
  })
  client.getQueryCache().subscribe((event) => {
    if (event.type === 'observerRemoved' && event.query.queryKey[0] === qk.requestPayloadsRoot[0]) {
      trimInactiveRequestPayloads(client)
    }
  })
  return client
}
