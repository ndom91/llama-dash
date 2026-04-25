import * as v from 'valibot'
import {
  CreateRoutingRuleBodySchema,
  ReorderRoutingRulesBodySchema,
  UpdateRoutingRuleBodySchema,
} from '../../../lib/schemas/routing-rule.ts'
import {
  createRoutingRule,
  deleteRoutingRule,
  listRoutingRules,
  reorderRoutingRules,
  updateRoutingRule,
} from '../routing-rules.ts'
import { error, json, readJsonBody, type Route } from './types.ts'

export const routingRoutes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/api\/routing-rules$/,
    handler: async () => json(200, { rules: listRoutingRules() }),
  },
  {
    method: 'POST',
    pattern: /^\/api\/routing-rules$/,
    handler: async (request) => {
      const parsed = await readJsonBody(request)
      if (!parsed.ok) return error(400, 'Invalid JSON body')
      const result = v.safeParse(CreateRoutingRuleBodySchema, parsed.value)
      if (!result.success) return error(400, 'Invalid routing rule body')
      try {
        return json(201, createRoutingRule(result.output))
      } catch (err) {
        return error(400, err instanceof Error ? err.message : String(err))
      }
    },
  },
  {
    method: 'PATCH',
    pattern: /^\/api\/routing-rules\/([a-zA-Z0-9_]+)$/,
    handler: async (request, match) => {
      const parsed = await readJsonBody(request)
      if (!parsed.ok) return error(400, 'Invalid JSON body')
      const result = v.safeParse(UpdateRoutingRuleBodySchema, parsed.value)
      if (!result.success) return error(400, 'Invalid routing rule body')
      if (
        result.output.name === undefined &&
        result.output.enabled === undefined &&
        result.output.match === undefined &&
        result.output.action === undefined &&
        result.output.target === undefined &&
        result.output.authMode === undefined &&
        result.output.preserveAuthorization === undefined
      ) {
        return error(400, 'At least one field to update is required')
      }
      try {
        const updated = updateRoutingRule(match[1], result.output)
        if (!updated) return error(404, `Routing rule ${match[1]} not found`)
        return json(200, updated)
      } catch (err) {
        return error(400, err instanceof Error ? err.message : String(err))
      }
    },
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/routing-rules\/([a-zA-Z0-9_]+)$/,
    handler: async (_request, match) => {
      const ok = deleteRoutingRule(match[1])
      if (!ok) return error(404, `Routing rule ${match[1]} not found`)
      return json(200, { ok: true })
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/routing-rules\/reorder$/,
    handler: async (request) => {
      const parsed = await readJsonBody(request)
      if (!parsed.ok) return error(400, 'Invalid JSON body')
      const result = v.safeParse(ReorderRoutingRulesBodySchema, parsed.value)
      if (!result.success) return error(400, 'Invalid reorder body')
      try {
        return json(200, { rules: reorderRoutingRules(result.output.ids) })
      } catch (err) {
        return error(400, err instanceof Error ? err.message : String(err))
      }
    },
  },
]
