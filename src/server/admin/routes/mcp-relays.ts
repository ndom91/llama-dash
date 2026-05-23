import * as v from 'valibot'
import { CreateMcpRelayBodySchema } from '../../../lib/schemas/mcp-relay.ts'
import { createMcpRelay, deleteMcpRelay, listMcpRelays } from '../mcp-relays.ts'
import { error, json, readJsonBody, type Route } from './types.ts'

export const mcpRelayRoutes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/api\/mcp-relays$/,
    handler: async () => json(200, { relays: listMcpRelays() }),
  },
  {
    method: 'POST',
    pattern: /^\/api\/mcp-relays$/,
    handler: async (request) => {
      const parsed = await readJsonBody(request)
      if (!parsed.ok) return error(400, 'Invalid JSON body')
      const result = v.safeParse(CreateMcpRelayBodySchema, parsed.value)
      if (!result.success) return error(400, 'Invalid MCP relay body')
      try {
        return json(201, createMcpRelay(result.output))
      } catch (err) {
        return error(400, err instanceof Error ? err.message : String(err))
      }
    },
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/mcp-relays\/([a-zA-Z0-9_]+)$/,
    handler: async (_request, match) => {
      const ok = deleteMcpRelay(match[1])
      if (!ok) return error(404, `MCP relay ${match[1]} not found`)
      return json(200, { ok: true })
    },
  },
]
