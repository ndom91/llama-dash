import Ajv, { type ValidateFunction } from 'ajv'
import addFormats from 'ajv-formats'
import {
  closeSync,
  copyFileSync,
  fsyncSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { config } from '../config.ts'

let cachedValidator: ValidateFunction | null = null
const SCHEMA_URL = 'https://raw.githubusercontent.com/mostlygeek/llama-swap/refs/heads/main/config-schema.json'

function configPath(): string {
  const p = config.inferenceConfigFile
  if (!p) throw new Error('INFERENCE_CONFIG_FILE is not set')
  return p
}

export function readConfig(): { content: string; modifiedAt: number } {
  const p = configPath()
  const content = readFileSync(p, 'utf-8')
  const stat = statSync(p)
  return { content, modifiedAt: stat.mtimeMs }
}

export type ValidationResult = { valid: true } | { valid: false; errors: Array<string> }

type WriteConfigResult =
  | { written: true; conflict: false; modifiedAt: number }
  | { written: false; conflict: true }
  | { written: false; conflict: false; errors: Array<string> }

async function getValidator(): Promise<ValidateFunction> {
  if (cachedValidator) return cachedValidator
  const res = await fetch(SCHEMA_URL)
  if (!res.ok) throw new Error(`Failed to fetch schema: ${res.status}`)
  const { $schema, ...schema } = (await res.json()) as Record<string, unknown>
  const ajv = new Ajv({ allErrors: true, strict: false })
  addFormats(ajv)
  cachedValidator = ajv.compile(schema)
  return cachedValidator
}

export async function validateAgainstSchema(content: string): Promise<ValidationResult> {
  let parsed: unknown
  try {
    parsed = parseYaml(content)
  } catch (err) {
    return { valid: false, errors: [err instanceof Error ? err.message : String(err)] }
  }

  try {
    const validate = await getValidator()
    const ok = validate(parsed)
    if (ok) return { valid: true }
    const errors = (validate.errors ?? []).map((e) => {
      const path = e.instancePath || '/'
      return `${path}: ${e.message}`
    })
    return { valid: false, errors }
  } catch (err) {
    return { valid: false, errors: [`Schema validation failed: ${err instanceof Error ? err.message : String(err)}`] }
  }
}

function fsyncDirectory(path: string) {
  let fd: number | null = null
  try {
    fd = openSync(path, 'r')
    fsyncSync(fd)
  } catch {
    // Directory fsync is not supported on every platform/filesystem.
  } finally {
    if (fd != null) closeSync(fd)
  }
}

function writeConfigAtomically(path: string, content: string, mode: number) {
  const dir = dirname(path)
  const base = basename(path)
  const tmpPath = join(dir, `.${base}.${process.pid}.${Date.now()}.tmp`)
  let fd: number | null = null

  try {
    fd = openSync(tmpPath, 'w', mode)
    writeFileSync(fd, content, 'utf-8')
    fsyncSync(fd)
    closeSync(fd)
    fd = null

    copyFileSync(path, `${path}.bak`)
    renameSync(tmpPath, path)
    fsyncDirectory(dir)
  } catch (err) {
    if (fd != null) {
      try {
        closeSync(fd)
      } catch {
        // Preserve the original write/rename error.
      }
    }
    try {
      unlinkSync(tmpPath)
    } catch {
      // Best-effort cleanup only; the original config remains untouched.
    }
    throw err
  }
}

export async function writeConfig(content: string, expectedModifiedAt: number): Promise<WriteConfigResult> {
  const validation = await validateAgainstSchema(content)
  if (!validation.valid) {
    return { written: false, conflict: false, errors: validation.errors }
  }

  const p = configPath()
  const stat = statSync(p)
  if (Math.abs(stat.mtimeMs - expectedModifiedAt) > 50) {
    return { written: false, conflict: true }
  }
  writeConfigAtomically(p, content, stat.mode & 0o777)
  const newStat = statSync(p)
  return { written: true, conflict: false, modifiedAt: newStat.mtimeMs }
}
