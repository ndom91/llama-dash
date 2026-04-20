export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(s < 10 ? 2 : 1)}s`
  const m = Math.floor(s / 60)
  const rem = Math.floor(s % 60)
  return `${m}m ${rem}s`
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
