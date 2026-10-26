import { useMemo } from 'react'
import type { RequestPayloads } from '../../lib/schemas/request'
import {
  analyzeResponse,
  analyzeTiming,
  parseHeaderMap,
  parseRequestPayload,
  parseSseStream,
} from './requestDetailUtils'

export function useRequestPayloadAnalysis(
  payloads: RequestPayloads | undefined,
  streamed: boolean,
  streamCloseMs: number | null,
) {
  const reqHeaders = useMemo(() => parseHeaderMap(payloads?.requestHeaders ?? null), [payloads?.requestHeaders])
  const resHeaders = useMemo(() => parseHeaderMap(payloads?.responseHeaders ?? null), [payloads?.responseHeaders])
  const requestPayload = useMemo(() => parseRequestPayload(payloads?.requestBody ?? null), [payloads?.requestBody])
  const responseAnalysis = useMemo(
    () => analyzeResponse(payloads?.responseBody ?? null, streamed),
    [payloads?.responseBody, streamed],
  )
  const parsedSse = useMemo(
    () => (streamed && payloads?.responseBody ? parseSseStream(payloads.responseBody) : null),
    [payloads?.responseBody, streamed],
  )
  const timing = useMemo(() => analyzeTiming(parsedSse, streamCloseMs), [parsedSse, streamCloseMs])
  return { reqHeaders, resHeaders, requestPayload, responseAnalysis, parsedSse, timing }
}
