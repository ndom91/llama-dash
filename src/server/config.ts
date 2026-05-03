const stripTrailingSlash = (s: string) => s.replace(/\/+$/, '')

const parseBool = (v: string | undefined, fallback: boolean): boolean => {
  if (v == null) return fallback
  return /^(1|true|yes)$/i.test(v)
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
}
