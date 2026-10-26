import type { RequestPayloads } from '../../lib/schemas/request'

export type RequestPayloadState =
  | { status: 'loading' }
  | { status: 'error'; message: string; data?: RequestPayloads }
  | { status: 'ready'; data: RequestPayloads }

export function requestPayloadState(
  data: RequestPayloads | undefined,
  error: Error | null,
  isMetadataLoading: boolean,
): RequestPayloadState {
  if (error) return { status: 'error', message: error.message, data }
  if (isMetadataLoading || !data) return { status: 'loading' }
  return { status: 'ready', data }
}
