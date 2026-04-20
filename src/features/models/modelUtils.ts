export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(s < 10 ? 2 : 1)}s`
  const m = Math.floor(s / 60)
  const rem = Math.floor(s % 60)
  return `${m}m ${rem}s`
}

export function formatTtl(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

export function parseModelConfigSnippet(snippet: string | null) {
  if (!snippet) return { aliases: [] as Array<string>, ctxSize: null as string | null, port: null as string | null }

  const aliasesMatch = snippet.match(/aliases:\s*\[([^\]]+)\]/)
  const ctxMatch = snippet.match(/--ctx-size\s+(\d+)/)
  const portMatch = snippet.match(/--port\s+(\$\{PORT\}|\d+)/)

  return {
    aliases: aliasesMatch ? aliasesMatch[1].split(',').map((part) => part.trim()) : [],
    ctxSize: ctxMatch ? Number(ctxMatch[1]).toLocaleString() : null,
    port: portMatch ? portMatch[1] : null,
  }
}
