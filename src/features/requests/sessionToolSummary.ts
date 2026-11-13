export type ToolCommand = { command: string; workdir?: string; exitCode?: number | null }
export type ToolSummary = {
  name: string
  summary: string
  commands: ToolCommand[]
  status: number | 'error' | null
  output: string
  size: number
}

function literal(value: string): string | null {
  const quote = value[0]
  if (quote === '`' && value.includes('${')) return null
  if (quote === '"') {
    try {
      return JSON.parse(value) as string
    } catch {
      return null
    }
  }
  return value
    .slice(1, -1)
    .replace(/\\(\\|'|`|n|r|t)/g, (_, char: string) => ({ n: '\n', r: '\r', t: '\t' })[char as 'n' | 'r' | 't'] ?? char)
}

export function parseCodexExec(source: string): ToolCommand[] {
  const commands: ToolCommand[] = []
  const objects = /\bexec_command\s*\(\s*\{((?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|[^}"'`])*)\}/g
  for (const match of source.matchAll(objects)) {
    const property = (name: string) => {
      const value = match[1].match(
        new RegExp(
          `(?:^|,)\\s*["']?${name}["']?\\s*:\\s*("(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'|\x60(?:\\\\.|[^\x60\\\\])*\x60)`,
        ),
      )
      return value ? literal(value[1]) : null
    }
    const command = property('cmd')
    if (command !== null) commands.push({ command, workdir: property('workdir') ?? undefined })
  }
  return commands
}

export function parseClaudeTool(name: string, input: string): { name: string; summary: string } {
  let args: Record<string, unknown> = {}
  try {
    const value: unknown = JSON.parse(input)
    if (value && typeof value === 'object' && !Array.isArray(value)) args = value as Record<string, unknown>
  } catch {}
  const key =
    name === 'Bash'
      ? 'command'
      : ['Read', 'Edit', 'Write'].includes(name)
        ? 'file_path'
        : name === 'WebFetch'
          ? 'url'
          : ['Grep', 'Glob'].includes(name)
            ? 'pattern'
            : ''
  const value = key ? args[key] : Object.values(args).find((item) => typeof item === 'string')
  const label = name.startsWith('mcp__') ? `mcp · ${name.slice(5).split('__')[0]}` : name
  return { name: label, summary: typeof value === 'string' ? value : input.split('\n')[0] }
}

export function parseToolResult(
  raw: string,
  isError = false,
): { output: string; exits: Array<number | null>; status: number | 'error' | null } {
  let value: unknown = raw
  try {
    value = JSON.parse(raw)
  } catch {}
  const exits: Array<number | null> = []
  let failed = isError
  const unwrap = (item: unknown): string => {
    if (typeof item === 'string') return item
    if (Array.isArray(item)) return item.map(unwrap).filter(Boolean).join('\n')
    if (!item || typeof item !== 'object') return ''
    const obj = item as Record<string, unknown>
    if (obj.status === 'rejected' || obj.is_error === true) failed = true
    if (Array.isArray(obj.results)) return unwrap(obj.results)
    if (obj.status === 'rejected') {
      exits.push(null)
      return typeof obj.reason === 'string' ? obj.reason : JSON.stringify(obj.reason ?? 'error')
    }
    if (obj.status === 'fulfilled') return unwrap(obj.value)
    if (typeof obj.exit_code === 'number') exits.push(obj.exit_code)
    else if ('output' in obj) exits.push(null)
    if ('output' in obj) return unwrap(obj.output)
    if ('content' in obj) return unwrap(obj.content)
    if (typeof obj.text === 'string') return obj.text
    if (typeof obj.message === 'string') return obj.message
    return JSON.stringify(item, null, 2)
  }
  const output = unwrap(value)
  return {
    output,
    exits,
    status: failed
      ? 'error'
      : (exits.find((code) => code !== null && code !== 0) ??
        (exits.length && exits.every((code) => code === 0) ? 0 : null)),
  }
}

export function summarizeTool(name: string, input: string, result?: { text: string; isError?: boolean }): ToolSummary {
  const parsed =
    name === 'exec'
      ? { name, summary: '', commands: parseCodexExec(input) }
      : { ...parseClaudeTool(name, input), commands: [] as ToolCommand[] }
  if (name === 'exec') parsed.summary = parsed.commands[0]?.command ?? input.split('\n')[0]
  const resultInfo = result ? parseToolResult(result.text, result.isError) : { output: '', exits: [], status: null }
  const commands = parsed.commands.map((command, index) => ({ ...command, exitCode: resultInfo.exits[index] }))
  return {
    name: parsed.name,
    summary: parsed.summary,
    commands,
    status: resultInfo.status,
    output: resultInfo.output,
    size: resultInfo.output ? resultInfo.output.split('\n').length : 0,
  }
}
