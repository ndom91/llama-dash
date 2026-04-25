import * as v from 'valibot'
import { CreateModelAliasBodySchema, UpdateModelAliasBodySchema } from '../../../lib/schemas/model-alias.ts'
import { createModelAlias, deleteModelAlias, listModelAliases, updateModelAlias } from '../model-aliases.ts'
import { error, json, readJsonBody, type Route } from './types.ts'

export const aliasRoutes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/api\/aliases$/,
    handler: async () => json(200, { aliases: listModelAliases() }),
  },
  {
    method: 'POST',
    pattern: /^\/api\/aliases$/,
    handler: async (request) => {
      const parsed = await readJsonBody(request)
      if (!parsed.ok) return error(400, 'Invalid JSON body')
      const result = v.safeParse(CreateModelAliasBodySchema, parsed.value)
      if (!result.success) return error(400, 'Body must have "alias" and "model" (non-empty strings)')
      try {
        return json(201, createModelAlias(result.output))
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('UNIQUE constraint')) return error(409, `Alias '${result.output.alias}' already exists`)
        throw err
      }
    },
  },
  {
    method: 'PATCH',
    pattern: /^\/api\/aliases\/([a-zA-Z0-9_]+)$/,
    handler: async (request, match) => {
      const parsed = await readJsonBody(request)
      if (!parsed.ok) return error(400, 'Invalid JSON body')
      const result = v.safeParse(UpdateModelAliasBodySchema, parsed.value)
      if (!result.success) return error(400, 'Body must have "alias" and/or "model" (non-empty strings)')
      if (!result.output.alias && !result.output.model) return error(400, 'At least one field to update is required')
      try {
        const updated = updateModelAlias(match[1], result.output)
        if (!updated) return error(404, `Alias ${match[1]} not found`)
        return json(200, updated)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('UNIQUE constraint')) return error(409, `Alias '${result.output.alias}' already exists`)
        throw err
      }
    },
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/aliases\/([a-zA-Z0-9_]+)$/,
    handler: async (_request, match) => {
      const ok = deleteModelAlias(match[1])
      if (!ok) return error(404, `Alias ${match[1]} not found`)
      return json(200, { ok: true })
    },
  },
]
