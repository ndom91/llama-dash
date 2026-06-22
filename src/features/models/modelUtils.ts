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
  const ctxMatch = snippet.match(/--ctx-size(?:\s+|=)(\d+)/)
  const portMatch = snippet.match(/--port\s+(\$\{PORT\}|\d+)/)

  return {
    aliases: aliasesMatch ? aliasesMatch[1].split(',').map((part) => part.trim()) : [],
    ctxSize: ctxMatch ? Number(ctxMatch[1]).toLocaleString() : null,
    port: portMatch ? portMatch[1] : null,
  }
}

export function formatContextLength(contextLength: number | null | undefined): string | null {
  if (contextLength == null) return null
  if (contextLength >= 1024) {
    const whole = contextLength / 1024
    return Number.isInteger(whole) ? `${whole}K` : `${whole.toFixed(1)}K`
  }
  return contextLength.toLocaleString()
}

export function formatCapabilityLabel(value: string): string {
  return value.replaceAll('_', ' ')
}

export function getModelCapabilityBadges(model: {
  capabilities: {
    inputModalities: Array<string>
    outputModalities: Array<string>
    flags: Array<string>
    supportedParameters: Array<string>
  }
}): Array<string> {
  const badges = [...model.capabilities.flags]
  if (model.capabilities.inputModalities.includes('image')) badges.unshift('image in')
  if (model.capabilities.inputModalities.includes('audio')) badges.unshift('audio in')
  if (model.capabilities.outputModalities.includes('image')) badges.unshift('image out')
  if (model.capabilities.outputModalities.includes('audio')) badges.unshift('audio out')
  return [...new Set(badges)]
}

export function hasModelCapabilities(model: Parameters<typeof getModelCapabilityBadges>[0]): boolean {
  return (
    model.capabilities.inputModalities.length > 0 ||
    model.capabilities.outputModalities.length > 0 ||
    model.capabilities.flags.length > 0 ||
    model.capabilities.supportedParameters.length > 0
  )
}
