export function toErrorBody(endpoint: string, body: { error: { message: string; type: string } }): unknown {
  if (!isAnthropicEndpoint(endpoint)) return body
  return { type: 'error', error: { type: body.error.type, message: body.error.message } }
}

function isAnthropicEndpoint(endpoint: string): boolean {
  return endpoint === '/v1/messages' || endpoint === '/v1/messages/count_tokens'
}
