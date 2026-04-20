import { ShieldAlert } from 'lucide-react'

export function KeysEmptyState() {
  return (
    <div className="empty-state keys-empty-state" style={{ paddingBlock: 32 }}>
      <ShieldAlert size={28} strokeWidth={1.5} style={{ color: 'var(--fg-dim)', marginBottom: 8 }} />
      <div style={{ marginBottom: 4 }}>No API keys configured</div>
      <div style={{ fontSize: 12, color: 'var(--fg-dim)' }}>
        The proxy is currently open — all requests pass through unauthenticated. Create a key to enable auth.
      </div>
    </div>
  )
}
