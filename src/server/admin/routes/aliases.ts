import { CreateModelAliasBodySchema, UpdateModelAliasBodySchema } from '../../../lib/schemas/model-alias.ts'
import { createModelAlias, deleteModelAlias, listModelAliases, updateModelAlias } from '../model-aliases.ts'
import { error, json, parseBody, type Route } from './types.ts'
import { errorMessage } from '../../error-message.ts'

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
      const result = await parseBody(
        request,
        CreateModelAliasBodySchema,
        'Body must have "alias" and "model" (non-empty strings)',
      )
      if (!result.ok) return result.response
      try {
        return json(201, createModelAlias(result.value))
      } catch (err) {
        const msg = errorMessage(err)
        if (msg.includes('UNIQUE constraint')) return error(409, `Alias '${result.value.alias}' already exists`)
        throw err
      }
    },
  },
  {
    method: 'PATCH',
    pattern: /^\/api\/aliases\/([a-zA-Z0-9_]+)$/,
    handler: async (request, match) => {
      const result = await parseBody(
        request,
        UpdateModelAliasBodySchema,
        'Body must have "alias" and/or "model" (non-empty strings)',
      )
      if (!result.ok) return result.response
      if (!result.value.alias && !result.value.model) return error(400, 'At least one field to update is required')
      try {
        const updated = updateModelAlias(match[1], result.value)
        if (!updated) return error(404, `Alias ${match[1]} not found`)
        return json(200, updated)
      } catch (err) {
        const msg = errorMessage(err)
        if (msg.includes('UNIQUE constraint')) return error(409, `Alias '${result.value.alias}' already exists`)
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
