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
import { error, json, parseBody, type Route } from './types.ts'
import { errorMessage } from '../../error-message.ts'

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
      const result = await parseBody(request, CreateRoutingRuleBodySchema, 'Invalid routing rule body')
      if (!result.ok) return result.response
      try {
        return json(201, createRoutingRule(result.value))
      } catch (err) {
        return error(400, errorMessage(err))
      }
    },
  },
  {
    method: 'PATCH',
    pattern: /^\/api\/routing-rules\/([a-zA-Z0-9_]+)$/,
    handler: async (request, match) => {
      const result = await parseBody(request, UpdateRoutingRuleBodySchema, 'Invalid routing rule body')
      if (!result.ok) return result.response
      if (
        result.value.name === undefined &&
        result.value.enabled === undefined &&
        result.value.match === undefined &&
        result.value.action === undefined &&
        result.value.target === undefined &&
        result.value.authMode === undefined &&
        result.value.preserveAuthorization === undefined &&
        result.value.credentialBindings === undefined
      ) {
        return error(400, 'At least one field to update is required')
      }
      try {
        const updated = updateRoutingRule(match[1], result.value)
        if (!updated) return error(404, `Routing rule ${match[1]} not found`)
        return json(200, updated)
      } catch (err) {
        return error(400, errorMessage(err))
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
      const result = await parseBody(request, ReorderRoutingRulesBodySchema, 'Invalid reorder body')
      if (!result.ok) return result.response
      try {
        return json(200, { rules: reorderRoutingRules(result.value.ids) })
      } catch (err) {
        return error(400, errorMessage(err))
      }
    },
  },
]
