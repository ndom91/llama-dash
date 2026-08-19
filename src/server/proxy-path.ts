// isInferenceProxyPath reports whether a path must bypass dashboard session routing.
export function isInferenceProxyPath(pathname: string): boolean {
  return (
    pathname === '/infill' || pathname === '/v1' || pathname.startsWith('/v1/') || pathname.startsWith('/audioapi/v1/')
  )
}
