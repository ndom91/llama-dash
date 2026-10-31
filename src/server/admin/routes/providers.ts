import * as v from 'valibot'
import {
  ConnectProviderBodySchema,
  ProviderConnectionListResponseSchema,
  ProviderTargetBodySchema,
  ProviderTestResultSchema,
  TestProviderBodySchema,
} from '../../../lib/schemas/provider.ts'
import {
  connectProvider,
  disconnectProvider,
  listProviderConnections,
  refreshProviderModels,
  testProviderConnection,
} from '../providers.ts'
import { error, json, readJsonBody, type Route } from './types.ts'

export const providerRoutes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/api\/providers$/,
    handler: async () => {
      const body = { connections: listProviderConnections() }
      return json(200, v.parse(ProviderConnectionListResponseSchema, body))
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/providers\/connect$/,
    handler: async (request) => {
      const parsed = await readJsonBody(request)
      if (!parsed.ok) return error(400, 'Invalid JSON body')
      const result = v.safeParse(ConnectProviderBodySchema, parsed.value)
      if (!result.success) return error(400, 'Invalid provider connection body')
      try {
        return json(201, await connectProvider(result.output))
      } catch (err) {
        return error(400, err instanceof Error ? err.message : String(err))
      }
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/providers\/disconnect$/,
    handler: async (request) => {
      const parsed = await readJsonBody(request)
      if (!parsed.ok) return error(400, 'Invalid JSON body')
      const result = v.safeParse(ProviderTargetBodySchema, parsed.value)
      if (!result.success) return error(400, 'Invalid provider disconnect body')
      const removed = disconnectProvider(result.output.targetId)
      if (!removed) return error(404, 'Provider is not connected')
      return json(200, { ok: true })
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/providers\/test$/,
    handler: async (request) => {
      const parsed = await readJsonBody(request)
      if (!parsed.ok) return error(400, 'Invalid JSON body')
      const result = v.safeParse(TestProviderBodySchema, parsed.value)
      if (!result.success) return error(400, 'Invalid provider test body')
      try {
        const outcome = await testProviderConnection(result.output.targetId, result.output.apiKey)
        return json(200, v.parse(ProviderTestResultSchema, outcome))
      } catch (err) {
        return error(400, err instanceof Error ? err.message : String(err))
      }
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/providers\/models\/refresh$/,
    handler: async (request) => {
      const parsed = await readJsonBody(request)
      if (!parsed.ok) return error(400, 'Invalid JSON body')
      const result = v.safeParse(ProviderTargetBodySchema, parsed.value)
      if (!result.success) return error(400, 'Invalid provider refresh body')
      try {
        return json(200, await refreshProviderModels(result.output.targetId))
      } catch (err) {
        return error(400, err instanceof Error ? err.message : String(err))
      }
    },
  },
]
