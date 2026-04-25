import * as v from 'valibot'
import { CreateApiKeyBodySchema, UpdateApiKeyBodySchema } from '../../../lib/schemas/api-key.ts'
import {
  createApiKey,
  deleteApiKey,
  getApiKeyById,
  getSystemKeyRaw,
  listApiKeys,
  revokeApiKey,
  updateApiKey,
} from '../api-keys.ts'
import { getKeyModelBreakdown, getKeyRequests, getKeyStats } from '../key-detail.ts'
import { error, json, readJsonBody, type Route } from './types.ts'

export const keyRoutes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/api\/keys$/,
    handler: async () => json(200, { keys: listApiKeys() }),
  },
  {
    method: 'POST',
    pattern: /^\/api\/keys$/,
    handler: async (request) => {
      const parsed = await readJsonBody(request)
      if (!parsed.ok) return error(400, 'Invalid JSON body')
      const result = v.safeParse(CreateApiKeyBodySchema, parsed.value)
      if (!result.success) return error(400, 'Body must have "name" (non-empty string)')
      return json(201, createApiKey(result.output))
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/keys\/([a-zA-Z0-9_]+)$/,
    handler: async (_request, match) => {
      const id = match[1]
      const key = getApiKeyById(id)
      if (!key) return error(404, `Key ${id} not found`)
      const [stats, requests, modelBreakdown] = await Promise.all([
        getKeyStats(id),
        getKeyRequests(id, 20),
        getKeyModelBreakdown(id),
      ])
      return json(200, { key, stats, requests, modelBreakdown })
    },
  },
  {
    method: 'PATCH',
    pattern: /^\/api\/keys\/([a-zA-Z0-9_]+)$/,
    handler: async (request, match) => {
      const parsed = await readJsonBody(request)
      if (!parsed.ok) return error(400, 'Invalid JSON body')
      const result = v.safeParse(UpdateApiKeyBodySchema, parsed.value)
      if (!result.success) return error(400, 'Body must have "name" (string) and/or "allowedModels" (string[])')
      const body = result.output
      if (!body.name && !body.allowedModels && body.systemPrompt === undefined) {
        return error(400, 'At least one field to update is required')
      }
      const ok = updateApiKey(match[1], {
        name: body.name?.trim(),
        allowedModels: body.allowedModels,
        systemPrompt: body.systemPrompt,
      })
      if (!ok) return error(404, `Key ${match[1]} not found`)
      return json(200, { ok: true })
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/keys\/([a-zA-Z0-9_]+)\/revoke$/,
    handler: async (_request, match) => {
      const ok = revokeApiKey(match[1])
      if (!ok) return error(404, `Key ${match[1]} not found or already revoked`)
      return json(200, { ok: true })
    },
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/keys\/([a-zA-Z0-9_]+)$/,
    handler: async (_request, match) => {
      const ok = deleteApiKey(match[1])
      if (!ok) return error(404, `Key ${match[1]} not found`)
      return json(200, { ok: true })
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/playground-key$/,
    handler: async () => {
      const raw = getSystemKeyRaw()
      if (!raw) return error(500, 'System key not available')
      return json(200, { key: raw })
    },
  },
]
