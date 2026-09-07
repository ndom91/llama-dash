import * as v from 'valibot'
import {
  CreateContextCompressionPolicyBodySchema,
  ReorderContextCompressionPoliciesBodySchema,
  UpdateContextCompressionPolicyBodySchema,
} from '../../../lib/schemas/context-compression.ts'
import {
  createContextCompressionPolicy,
  deleteContextCompressionPolicy,
  listContextCompressionPolicies,
  reorderContextCompressionPolicies,
  updateContextCompressionPolicy,
} from '../context-compression.ts'
import { error, json, readJsonBody, type Route } from './types.ts'

export const contextCompressionRoutes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/api\/context-compression\/policies$/,
    handler: async () => json(200, { rules: listContextCompressionPolicies() }),
  },
  {
    method: 'POST',
    pattern: /^\/api\/context-compression\/policies$/,
    handler: async (request) => {
      const body = await readJsonBody(request)
      const parsed = body.ok ? v.safeParse(CreateContextCompressionPolicyBodySchema, body.value) : null
      return parsed?.success
        ? json(201, createContextCompressionPolicy(parsed.output))
        : error(400, 'Invalid context compression policy body')
    },
  },
  {
    method: 'PATCH',
    pattern: /^\/api\/context-compression\/policies\/([a-zA-Z0-9_]+)$/,
    handler: async (request, match) => {
      const body = await readJsonBody(request)
      const parsed = body.ok ? v.safeParse(UpdateContextCompressionPolicyBodySchema, body.value) : null
      if (!parsed?.success || Object.keys(parsed.output).length === 0)
        return error(400, 'Invalid context compression policy body')
      const policy = updateContextCompressionPolicy(match[1], parsed.output)
      return policy ? json(200, policy) : error(404, `Context compression policy ${match[1]} not found`)
    },
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/context-compression\/policies\/([a-zA-Z0-9_]+)$/,
    handler: async (_request, match) =>
      deleteContextCompressionPolicy(match[1])
        ? json(200, { ok: true })
        : error(404, `Context compression policy ${match[1]} not found`),
  },
  {
    method: 'POST',
    pattern: /^\/api\/context-compression\/policies\/reorder$/,
    handler: async (request) => {
      const body = await readJsonBody(request)
      const parsed = body.ok ? v.safeParse(ReorderContextCompressionPoliciesBodySchema, body.value) : null
      if (!parsed?.success) return error(400, 'Invalid reorder body')
      try {
        return json(200, { rules: reorderContextCompressionPolicies(parsed.output.ids) })
      } catch (err) {
        return error(400, err instanceof Error ? err.message : String(err))
      }
    },
  },
]
