import { CreateMcpRelayBodySchema } from '../../../lib/schemas/mcp-relay.ts'
import { createMcpRelay, deleteMcpRelay, listMcpRelays } from '../mcp-relays.ts'
import { error, json, parseBody, type Route } from './types.ts'
import { errorMessage } from '../../error-message.ts'

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
      const result = await parseBody(request, CreateMcpRelayBodySchema, 'Invalid MCP relay body')
      if (!result.ok) return result.response
      try {
        return json(201, createMcpRelay(result.value))
      } catch (err) {
        return error(400, errorMessage(err))
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
