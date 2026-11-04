import type { ApiKeyItem } from '../../lib/api'

export function isInactiveKey(key: Pick<ApiKeyItem, 'disabledAt' | 'expiresAt'>) {
  return key.disabledAt != null || (key.expiresAt != null && new Date(key.expiresAt).getTime() <= Date.now())
}

export function formatRelative(timestamp: string) {
  const diff = Date.now() - new Date(timestamp).getTime()
  const mins = Math.max(1, Math.round(diff / 60_000))
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hr ago`
  return `${Math.round(hours / 24)} d ago`
}

export function buildKeySnippet(keyPrefix: string) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://llama-dash.example'

  return `curl ${origin}/v1/\\
  chat/completions \\
  -H "Authorization: Bearer ${keyPrefix}…" \\
  -d '{"model":"gemma-4",\\
    "messages":[…]}'`
}
