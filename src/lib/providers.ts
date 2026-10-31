/**
 * Known upstream providers llswap-dash can proxy to.
 *
 * A **target** is one subscription entry point: one provider, one plan, one
 * region, and therefore ONE API key. Each target exposes one or more
 * **surfaces** (OpenAI Chat Completions, Anthropic Messages, OpenAI Responses)
 * mounted at that origin. Connecting a target wires every surface at once —
 * the operator never connects "OpenAI" and "Anthropic" separately.
 *
 * Models are NOT hardcoded here. They are discovered at connect time from the
 * provider's own `/v1/models` listing and stored with the connection.
 *
 * This is a shared module (client + server) — the server resolves path joins
 * and auth headers from it, the client renders the picker from it.
 */

export type ProviderApiStyle = 'openai' | 'anthropic'

/**
 * How the incoming proxy path is joined onto the provider base URL.
 *
 * - `strip-v1` — the base URL already carries the API version segment
 *   (`/v1`, `/v4`, `/paas/v4`), so the incoming `/v1` prefix is dropped:
 *   `https://api.minimax.io/v1` + `/v1/chat/completions` → `…/v1/chat/completions`.
 * - `keep-v1` — the base URL is a mount point (`/anthropic`) and the incoming
 *   path is appended verbatim:
 *   `https://api.minimax.io/anthropic` + `/v1/messages` → `…/anthropic/v1/messages`.
 */
export const PROVIDER_PATH_JOINS = ['strip-v1', 'keep-v1'] as const
export type ProviderPathJoin = (typeof PROVIDER_PATH_JOINS)[number]

/** Header the provider expects the API key in. */
export const PROVIDER_AUTH_HEADERS = ['authorization', 'x-api-key'] as const
export type ProviderAuthHeader = (typeof PROVIDER_AUTH_HEADERS)[number]

/** How the key is formatted inside that header. */
export type ProviderAuthScheme = 'bearer' | 'raw'

/**
 * One header the provider accepts the API key in.
 *
 * `bearer` prefixes the value with `Bearer `; `raw` sends it verbatim.
 * Anthropic-compatible surfaces accept either, so they list both — the proxy
 * sends both so any SDK works.
 */
export type ProviderAuthBinding = {
  name: ProviderAuthHeader
  scheme: ProviderAuthScheme
}

/** One API surface of a target: its mount path, join semantics, and auth. */
export type ProviderSurface = {
  apiStyle: ProviderApiStyle
  /** Path mounted on the target origin, e.g. `/v1`, `/anthropic`, `/api/paas/v4`. */
  path: string
  pathJoin: ProviderPathJoin
  /** Proxy endpoints this surface serves. Used to scope routing rules. */
  matchEndpoints: string[]
  /** Headers the provider accepts the API key in. */
  authHeaders: ProviderAuthBinding[]
}

/** One subscription entry point: provider + plan + region = one API key. */
export type ProviderTarget = {
  id: string
  providerLabel: string
  planLabel: string
  /** Full display name shown in the picker. */
  label: string
  origin: string
  surfaces: ProviderSurface[]
  docsUrl: string
  /** Where the operator obtains the API key for this target. */
  consoleUrl: string
  note?: string
}

/** A concrete upstream surface derived from a target. */
export type ProviderEndpoint = {
  id: string
  targetId: string
  label: string
  apiStyle: ProviderApiStyle
  baseUrl: string
  pathJoin: ProviderPathJoin
  matchEndpoints: string[]
  authHeaders: ProviderAuthBinding[]
}

const OPENAI_COMPLETIONS = ['/v1/chat/completions', '/v1/completions']
const ANTHROPIC_MESSAGES = ['/v1/messages', '/v1/messages/count_tokens']
/** OpenAI-compatible media endpoints served by provider TTS/ASR/image models. */
const OPENAI_MEDIA = ['/v1/audio/speech', '/v1/audio/transcriptions', '/v1/images/generations']

const BEARER: ProviderAuthBinding[] = [{ name: 'authorization', scheme: 'bearer' }]
const ANTHROPIC_AUTH: ProviderAuthBinding[] = [
  { name: 'x-api-key', scheme: 'raw' },
  { name: 'authorization', scheme: 'bearer' },
]

/** The MiMo-style surface pair: OpenAI at `/v1`, Anthropic at `/anthropic`. */
const MIMO_SURFACES: ProviderSurface[] = [
  {
    apiStyle: 'openai',
    path: '/v1',
    pathJoin: 'strip-v1',
    matchEndpoints: [...OPENAI_COMPLETIONS, ...OPENAI_MEDIA],
    authHeaders: BEARER,
  },
  {
    apiStyle: 'anthropic',
    path: '/anthropic',
    pathJoin: 'keep-v1',
    matchEndpoints: ANTHROPIC_MESSAGES,
    authHeaders: ANTHROPIC_AUTH,
  },
]

export const PROVIDER_TARGETS: readonly ProviderTarget[] = [
  {
    id: 'minimax',
    providerLabel: 'MiniMax',
    planLabel: 'Pay-as-you-go',
    label: 'MiniMax · Pay-as-you-go',
    origin: 'https://api.minimax.io',
    surfaces: MIMO_SURFACES,
    docsUrl: 'https://platform.minimax.io/docs/api-reference/text-openai-api',
    consoleUrl: 'https://platform.minimax.io/user-center/basic-information/interface-key',
    note: 'The Anthropic surface serves MiniMax-M3.1-Flash and MiniMax-M3 only.',
  },
  {
    id: 'mimo',
    providerLabel: 'Xiaomi MiMo',
    planLabel: 'Pay-as-you-go',
    label: 'Xiaomi MiMo · Pay-as-you-go',
    origin: 'https://api.xiaomimimo.com',
    surfaces: MIMO_SURFACES,
    docsUrl: 'https://mimo.mi.com/docs/en-US/quick-start/summary/first-api-call',
    consoleUrl: 'https://platform.xiaomimimo.com/#/console/api-key',
    note: 'Pay-as-you-go keys look like sk-…',
  },
  {
    id: 'mimo-tokenplan-cn',
    providerLabel: 'Xiaomi MiMo',
    planLabel: 'Token Plan · CN',
    label: 'Xiaomi MiMo · Token Plan · CN',
    origin: 'https://token-plan-cn.xiaomimimo.com',
    surfaces: MIMO_SURFACES,
    docsUrl: 'https://mimo.mi.com/docs/en-US/tokenplan/integration/claudecode',
    consoleUrl: 'https://platform.xiaomimimo.com/token-plan',
    note: 'Token Plan keys look like tp-… (individual) or ttp-… (team).',
  },
  {
    id: 'mimo-tokenplan-sgp',
    providerLabel: 'Xiaomi MiMo',
    planLabel: 'Token Plan · SGP',
    label: 'Xiaomi MiMo · Token Plan · SGP',
    origin: 'https://token-plan-sgp.xiaomimimo.com',
    surfaces: MIMO_SURFACES,
    docsUrl: 'https://mimo.mi.com/docs/en-US/tokenplan/integration/claudecode',
    consoleUrl: 'https://platform.xiaomimimo.com/token-plan',
    note: 'Token Plan keys look like tp-… (individual) or ttp-… (team).',
  },
  {
    id: 'zai',
    providerLabel: 'Z.AI GLM',
    planLabel: 'Pay-as-you-go',
    label: 'Z.AI GLM · Pay-as-you-go',
    origin: 'https://api.z.ai',
    surfaces: [
      {
        apiStyle: 'openai',
        path: '/api/paas/v4',
        pathJoin: 'strip-v1',
        matchEndpoints: [...OPENAI_COMPLETIONS, ...OPENAI_MEDIA],
        authHeaders: BEARER,
      },
      {
        apiStyle: 'anthropic',
        path: '/api/anthropic',
        pathJoin: 'keep-v1',
        matchEndpoints: ANTHROPIC_MESSAGES,
        authHeaders: ANTHROPIC_AUTH,
      },
      {
        apiStyle: 'openai',
        path: '/api/v1',
        pathJoin: 'strip-v1',
        matchEndpoints: ['/v1/responses'],
        authHeaders: BEARER,
      },
    ],
    docsUrl: 'https://docs.z.ai/guides/develop/http/introduction',
    consoleUrl: 'https://z.ai/manage-apikey/apikey-list',
  },
  {
    id: 'zai-coding',
    providerLabel: 'Z.AI GLM',
    planLabel: 'Coding Plan',
    label: 'Z.AI GLM · Coding Plan',
    origin: 'https://api.z.ai',
    surfaces: [
      {
        apiStyle: 'openai',
        path: '/api/coding/paas/v4',
        pathJoin: 'strip-v1',
        matchEndpoints: [...OPENAI_COMPLETIONS, ...OPENAI_MEDIA],
        authHeaders: BEARER,
      },
      {
        apiStyle: 'anthropic',
        path: '/api/anthropic',
        pathJoin: 'keep-v1',
        matchEndpoints: ANTHROPIC_MESSAGES,
        authHeaders: ANTHROPIC_AUTH,
      },
      {
        apiStyle: 'openai',
        path: '/api/v1',
        pathJoin: 'strip-v1',
        matchEndpoints: ['/v1/responses'],
        authHeaders: BEARER,
      },
    ],
    docsUrl: 'https://docs.z.ai/devpack/quick-start',
    consoleUrl: 'https://z.ai/manage-apikey/apikey-list',
    note: 'GLM Coding Plan subscription.',
  },
]

function joinUrl(origin: string, path: string): string {
  return `${origin.replace(/\/$/, '')}${path}`
}

/** Every concrete surface, flattened for the routing picker and allowlist. */
export const PROVIDER_ENDPOINTS: readonly ProviderEndpoint[] = PROVIDER_TARGETS.flatMap((target) =>
  target.surfaces.map((surface) => ({
    id: `${target.id}-${surface.apiStyle}`,
    targetId: target.id,
    label: `${target.label} · ${surface.apiStyle}`,
    apiStyle: surface.apiStyle,
    baseUrl: joinUrl(target.origin, surface.path),
    pathJoin: surface.pathJoin,
    matchEndpoints: surface.matchEndpoints,
    authHeaders: surface.authHeaders,
  })),
)

/** Hosts allowed before the public API (kept for the non-provider upstreams). */
export const LEGACY_DIRECT_UPSTREAM_HOSTS = ['api.openai.com', 'api.anthropic.com', 'chatgpt.com'] as const

export const CHATGPT_CODEX_BASE_URL = 'https://chatgpt.com/backend-api/codex'

/** Every provider host llswap-dash is willing to forward a direct upstream request to. */
export const PROVIDER_ENDPOINT_HOSTS: readonly string[] = [
  ...new Set(PROVIDER_TARGETS.map((target) => new URL(target.origin).hostname.toLowerCase())),
]

/** Every host llswap-dash is willing to forward a direct upstream request to. */
export const ALLOWED_DIRECT_UPSTREAM_HOSTS = new Set<string>([
  ...LEGACY_DIRECT_UPSTREAM_HOSTS,
  ...PROVIDER_ENDPOINT_HOSTS,
])

function normalizeBaseUrl(baseUrl: string): string | null {
  try {
    const url = new URL(baseUrl)
    const path = url.pathname.replace(/\/+$/, '')
    return `${url.origin}${path}`
  } catch {
    return null
  }
}

export function findProviderTarget(id: string): ProviderTarget | undefined {
  return PROVIDER_TARGETS.find((target) => target.id === id)
}

export function findProviderEndpoint(id: string): ProviderEndpoint | undefined {
  return PROVIDER_ENDPOINTS.find((endpoint) => endpoint.id === id)
}

/** Resolve the provider surface that owns a base URL, if any. */
export function providerEndpointForBaseUrl(baseUrl: string): ProviderEndpoint | undefined {
  const normalized = normalizeBaseUrl(baseUrl)
  if (!normalized) return undefined
  return PROVIDER_ENDPOINTS.find((endpoint) => normalizeBaseUrl(endpoint.baseUrl) === normalized)
}

/** URL of the model listing for a surface — used to discover models at connect time. */
export function providerModelsUrl(baseUrl: string, pathJoin: ProviderPathJoin): string {
  const base = new URL(baseUrl)
  if (pathJoin === 'keep-v1') {
    base.pathname = `${base.pathname.replace(/\/$/, '')}/v1/models`
  } else {
    base.pathname = `${base.pathname.replace(/\/$/, '')}/models`
  }
  return base.toString()
}

/** Format an API key for a surface's auth header. */
export function providerAuthValue(binding: ProviderAuthBinding, apiKey: string): string {
  return binding.scheme === 'bearer' ? `Bearer ${apiKey}` : apiKey
}
