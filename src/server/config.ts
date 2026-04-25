const stripTrailingSlash = (s: string) => s.replace(/\/+$/, '')

const parseBool = (v: string | undefined, fallback: boolean): boolean => {
  if (v == null) return fallback
  return /^(1|true|yes)$/i.test(v)
}

export const config = {
  llamaSwapUrl: stripTrailingSlash(process.env.LLAMASWAP_URL ?? 'http://localhost:8080'),
  llamaSwapInsecure: parseBool(process.env.LLAMASWAP_INSECURE, false),
  llamaSwapConfigFile: process.env.LLAMASWAP_CONFIG_FILE ?? '',
  databasePath: process.env.DATABASE_PATH ?? 'data/dash.db',
  authSecret: process.env.BETTER_AUTH_SECRET ?? '',
  authUrl: process.env.BETTER_AUTH_URL ? stripTrailingSlash(process.env.BETTER_AUTH_URL) : '',
}
