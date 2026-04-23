import { normalizeAttributionHeaderName, type AttributionSettings } from '../../lib/schemas/attribution'

export type RequestAttribution = {
  clientName: string | null
  endUserId: string | null
  sessionId: string | null
}

function normalizeHeaderValue(value: string | null): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed ? trimmed : null
}

function inferClientNameFromUserAgent(headers: Headers): string | null {
  const userAgent = headers.get('user-agent')?.toLowerCase() ?? ''
  if (!userAgent) return null
  if (userAgent.includes('claude-code')) return 'claude-code'
  if (userAgent.includes('opencode')) return 'opencode'
  if (userAgent.includes('open-webui') || userAgent.includes('openwebui')) return 'open-webui'
  if (
    userAgent.includes('home assistant') ||
    userAgent.includes('home-assistant') ||
    userAgent.includes('homeassistant')
  ) {
    return 'home-assistant'
  }
  if (userAgent.startsWith('curl/')) return 'curl'
  if (userAgent.startsWith('python-requests/')) return 'python-requests'
  return null
}

export function extractAttribution(headers: Headers, settings: AttributionSettings): RequestAttribution {
  const getSafe = (headerName: string | null) => {
    const normalized = normalizeAttributionHeaderName(headerName)
    if (!normalized) return null
    try {
      return headers.get(normalized)
    } catch {
      return null
    }
  }

  const explicitClientName = normalizeHeaderValue(getSafe(settings.clientNameHeader))

  return {
    clientName: explicitClientName ?? inferClientNameFromUserAgent(headers),
    endUserId: normalizeHeaderValue(getSafe(settings.endUserIdHeader)),
    sessionId: normalizeHeaderValue(getSafe(settings.sessionIdHeader)),
  }
}
