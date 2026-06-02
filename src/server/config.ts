import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

loadDotEnvFile()

const stripTrailingSlash = (s: string) => s.replace(/\/+$/, '')

const parseBool = (v: string | undefined, fallback: boolean): boolean => {
  if (v == null) return fallback
  return /^(1|true|yes)$/i.test(v)
}

const parseMs = (v: string | undefined, fallback: number): number => {
  if (v == null) return fallback
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

export const config = {
  inferenceBackend: process.env.INFERENCE_BACKEND ?? 'llama-swap',
  inferenceBaseUrl: stripTrailingSlash(process.env.INFERENCE_BASE_URL ?? 'http://localhost:8080'),
  inferenceInsecure: parseBool(process.env.INFERENCE_INSECURE, false),
  inferenceConfigFile: process.env.INFERENCE_CONFIG_FILE ?? '',
  databasePath: process.env.DATABASE_PATH ?? 'data/dash.db',
  authSecret: process.env.BETTER_AUTH_SECRET ?? '',
  authUrl: process.env.BETTER_AUTH_URL ? stripTrailingSlash(process.env.BETTER_AUTH_URL) : '',
  internalOrigin: process.env.INTERNAL_ORIGIN ? stripTrailingSlash(process.env.INTERNAL_ORIGIN) : '',
  credentialEncryptionKey: process.env.CREDENTIAL_ENCRYPTION_KEY ?? '',
  // Upstream fetch timeouts (ms). 0 disables. Headers timeout must be generous
  // for long non-streaming jobs (e.g. image gen) that send no response headers
  // until the full result is rendered. Defaults to 10 min headers / no body cap.
  upstreamHeadersTimeoutMs: parseMs(process.env.UPSTREAM_HEADERS_TIMEOUT_MS, 600_000),
  upstreamBodyTimeoutMs: parseMs(process.env.UPSTREAM_BODY_TIMEOUT_MS, 0),
}

function loadDotEnvFile() {
  const path = resolve(process.cwd(), '.env')
  if (!existsSync(path)) return
  const lines = readFileSync(path, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    const [, key, rawValue] = match
    if (process.env[key] != null) continue
    process.env[key] = parseDotEnvValue(rawValue)
  }
}

function parseDotEnvValue(raw: string): string {
  const value = raw.trim()
  if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1).replace(/\\n/g, '\n')
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1)
  const commentIndex = value.indexOf(' #')
  return commentIndex >= 0 ? value.slice(0, commentIndex).trimEnd() : value
}
