import Ajv, { type ValidateFunction } from 'ajv'
import addFormats from 'ajv-formats'
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { parse as parseYaml } from 'yaml'
import { config } from '../config.ts'

let cachedValidator: ValidateFunction | null = null
const SCHEMA_URL = 'https://raw.githubusercontent.com/mostlygeek/llama-swap/refs/heads/main/config-schema.json'

function configPath(): string {
  const p = config.llamaSwapConfigFile
  if (!p) throw new Error('LLAMASWAP_CONFIG_FILE is not set')
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
  writeFileSync(p, content, 'utf-8')
  const newStat = statSync(p)
  return { written: true, conflict: false, modifiedAt: newStat.mtimeMs }
}
