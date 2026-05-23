export const MCP_RELAY_ENDPOINT_PREFIX = '/mcp-relays/'
export const MCP_RELAY_ENDPOINT_LIKE_PATTERN = `${MCP_RELAY_ENDPOINT_PREFIX}%`

export function isMcpRelayEndpoint(endpoint: string): boolean {
  return endpoint.startsWith(MCP_RELAY_ENDPOINT_PREFIX)
}
