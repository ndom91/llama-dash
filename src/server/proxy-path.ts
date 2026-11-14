// llama-swap model routes outside /v1 (llama-swap v272, internal/server/server.go).
const EXACT_PROXY_PATHS = new Set([
  '/infill',
  '/completion',
  '/rerank',
  '/reranking',
  '/props',
  '/v1',
  '/audiocpp',
  '/comfyui',
])
const PROXY_PATH_PREFIXES = ['/v1/', '/v/', '/audioapi/v1/', '/audiocpp/', '/comfyui/', '/sdapi/v1/']

// isInferenceProxyPath reports whether a path must bypass dashboard session routing.
export function isInferenceProxyPath(pathname: string): boolean {
  return EXACT_PROXY_PATHS.has(pathname) || PROXY_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

/**
 * llama-swap serves versionless `/v/...` aliases of the `/v1/...` routes
 * (issue #728). Treat them as the same endpoint for routing rules, logging,
 * usage and metrics; the upstream request keeps the original path.
 */
export function canonicalProxyEndpoint(pathname: string): string {
  return pathname.startsWith('/v/') ? `/v1/${pathname.slice('/v/'.length)}` : pathname
}
