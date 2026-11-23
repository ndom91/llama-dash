import { ENDPOINT_TYPE_IDS, type EndpointType } from './endpointTypes'
import { ENDPOINT_CLIENT_IDS, type EndpointClient } from './snippets'

export type ConnectSearch = {
  type?: EndpointType
  client?: EndpointClient
  model?: string
}

function oneOf<T extends string>(value: unknown, allowed: ReadonlyArray<T>): T | undefined {
  return allowed.find((item) => item === value)
}

/** Unknown values are dropped, so a stale link falls back to the defaults. */
export function validateConnectSearch(search: Record<string, unknown>): ConnectSearch {
  return {
    type: oneOf(search.type, ENDPOINT_TYPE_IDS),
    client: oneOf(search.client, ENDPOINT_CLIENT_IDS),
    model: typeof search.model === 'string' && search.model.length > 0 ? search.model : undefined,
  }
}
