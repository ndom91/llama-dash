import { ShieldAlert } from 'lucide-react'

export function KeysEmptyState() {
  return (
    <div className="empty-state px-6 py-8 max-md:px-3">
      <ShieldAlert size={28} strokeWidth={1.5} className="mb-2 text-fg-dim inline-block" />
      <div className="mb-1">No API keys configured</div>
      <div className="text-xs text-fg-dim">
        The proxy is currently open — all requests pass through unauthenticated. Create a key to enable auth.
      </div>
    </div>
  )
}
