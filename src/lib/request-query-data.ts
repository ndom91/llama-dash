import type { InfiniteData } from '@tanstack/react-query'
import type { InferOutput } from 'valibot'
import type { RequestsListResponseSchema } from './schemas/request'

export const REQUESTS_PAGE_SIZE = 50
export type RequestsPageParam = { cursor?: string; limit: number }
export type RequestListQuery = {
  search: string
  modelFilter: readonly string[]
  keyFilter: readonly string[]
  routingFilter: 'all' | 'routed' | 'unrouted'
  clientFilter: string
  hostFilter: readonly string[]
  endUserFilter: string
  sessionFilter: string
  includeMcp: boolean
}
export type RequestsPage = InferOutput<typeof RequestsListResponseSchema>
export type RequestsList = InfiniteData<RequestsPage, RequestsPageParam>
