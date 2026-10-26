import type { InfiniteData } from '@tanstack/react-query'
import type { InferOutput } from 'valibot'
import type { RequestsListResponseSchema } from './schemas/request'

export const REQUESTS_PAGE_SIZE = 50
export type RequestsPage = InferOutput<typeof RequestsListResponseSchema>
export type RequestsList = InfiniteData<RequestsPage, string | undefined>
