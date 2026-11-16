import type { InfiniteData } from '@tanstack/react-query'
import type { InferOutput } from 'valibot'
import type { RequestListFilters } from './request-filters'
import type { RequestInterval, RequestTimeFilter } from './request-timeframe'
import type { RequestSort } from './request-sort'
import type { RequestsListResponseSchema } from './schemas/request'

export const REQUESTS_PAGE_SIZE = 50
export type RequestsPageParam = string | undefined
export type RequestListQuery = Omit<RequestListFilters, 'statusFilter'> &
  RequestSort &
  RequestTimeFilter & {
    ranges?: RequestInterval[]
    search: string
    includeMcp: boolean
  }
export type RequestsPage = InferOutput<typeof RequestsListResponseSchema>
export type RequestsList = InfiniteData<RequestsPage, RequestsPageParam>
