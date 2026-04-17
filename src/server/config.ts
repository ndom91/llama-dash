const stripTrailingSlash = (s: string) => s.replace(/\/+$/, '')

const parseBool = (v: string | undefined, fallback: boolean): boolean => {
  if (v == null) return fallback
  return /^(1|true|yes)$/i.test(v)
}

export const config = {
  llamaSwapUrl: stripTrailingSlash(process.env.LLAMASWAP_URL ?? 'http://llama-swap.puff.lan'),
  /**
   * Skip TLS certificate verification on upstream llama-swap calls. Off by
   * default — set to true when pointing at an HTTPS upstream with a self-signed
   * cert (e.g. the reference deployment's internal-CA cert on :443).
   */
  llamaSwapInsecure: parseBool(process.env.LLAMASWAP_INSECURE, false),
  databasePath: process.env.DATABASE_PATH ?? 'data/dash.db',
}
