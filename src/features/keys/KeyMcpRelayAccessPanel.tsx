import { cn } from '../../lib/cn'
import { useMcpRelays, useUpdateKeyMcpRelays } from '../../lib/queries'

type Props = {
  keyId: string
  allowedMcpRelays: Array<string>
  isRevoked: boolean
}

export function KeyMcpRelayAccessPanel({ keyId, allowedMcpRelays, isRevoked }: Props) {
  const { data: relays } = useMcpRelays()
  const updateRelays = useUpdateKeyMcpRelays()

  const toggleRelay = (relayId: string) => {
    if (isRevoked) return
    const next = allowedMcpRelays.includes(relayId)
      ? allowedMcpRelays.filter((id) => id !== relayId)
      : [...allowedMcpRelays, relayId]
    updateRelays.mutate({ id: keyId, allowedMcpRelays: next })
  }

  if (!relays) return null

  return (
    <section className="panel detail-stacked-section">
      <div className="panel-head">
        <span className="panel-title text-fg-muted">MCP relay access</span>
        <span className="panel-sub">
          · {allowedMcpRelays.length === 0 ? 'none' : `${allowedMcpRelays.length} allowed`}
        </span>
      </div>
      {relays.length === 0 ? (
        <div className="px-4 py-3 font-mono text-xs text-fg-faint">No MCP relays configured.</div>
      ) : (
        <table className="dtable">
          <thead>
            <tr>
              <th style={{ width: 32 }} aria-label="enabled" />
              <th className="mono">relay</th>
              <th className="mono">target</th>
            </tr>
          </thead>
          <tbody>
            {relays.map((relay) => {
              const enabled = allowedMcpRelays.includes(relay.id)
              return (
                <tr key={relay.id} className={cn(!enabled && 'opacity-40')}>
                  <td>
                    <input
                      type="checkbox"
                      checked={enabled}
                      disabled={isRevoked || updateRelays.isPending}
                      onChange={() => toggleRelay(relay.id)}
                      className="accent-accent size-3.5 cursor-pointer disabled:cursor-default"
                    />
                  </td>
                  <td className="mono" translate="no">
                    {relay.name}
                    <span className="ml-2 text-fg-faint">/mcp-relays/{relay.slug}</span>
                  </td>
                  <td className="mono text-fg-dim" translate="no">
                    {relay.targetUrl}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}
