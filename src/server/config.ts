const required = (name: string, value: string | undefined): string => {
  if (!value || value.length === 0) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

const stripTrailingSlash = (s: string) => s.replace(/\/+$/, '')

export const config = {
  llamaSwapUrl: stripTrailingSlash(
    process.env.LLAMASWAP_URL ?? 'http://llama-swap.puff.lan',
  ),
  databasePath: process.env.DATABASE_PATH ?? 'data/dash.db',
  get nodeEnv() {
    return required('NODE_ENV', process.env.NODE_ENV ?? 'development')
  },
}
