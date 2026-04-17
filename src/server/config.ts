const stripTrailingSlash = (s: string) => s.replace(/\/+$/, '')

const parseBool = (v: string | undefined, fallback: boolean): boolean => {
  if (v == null) return fallback
  return /^(1|true|yes)$/i.test(v)
}

export const config = {
  llamaSwapUrl: stripTrailingSlash(process.env.LLAMASWAP_URL ?? 'https://llama-swap.puff.lan'),
  /**
   * Skip TLS certificate verification on upstream llama-swap calls. Defaults
   * to true because the reference deployment uses an internal-CA self-signed
   * cert that Node doesn't trust by default. Flip to false once the dashboard
   * fronts a publicly-trusted endpoint.
   */
  llamaSwapInsecure: parseBool(process.env.LLAMASWAP_INSECURE, true),
  databasePath: process.env.DATABASE_PATH ?? 'data/dash.db',
}
