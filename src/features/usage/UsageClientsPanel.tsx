import { useNavigate } from '@tanstack/react-router'
import type { ApiUsageClient } from '../../lib/api'
import { clickableRowFocusClass, clickableRowProps } from '../../lib/clickable-row-props'
import { cn } from '../../lib/cn'
import { UsagePanel } from './UsagePanel'
import { UsageShareBar } from './UsageShareBar'
import { formatTokens } from './usageUtils'

type Props = {
  clients: Array<ApiUsageClient>
}

export function UsageClientsPanel({ clients }: Props) {
  const navigate = useNavigate()
  const total = clients.reduce((acc, c) => acc + c.totalTokens, 0)
  return (
    <UsagePanel title="By app" sub={`${clients.length} client${clients.length === 1 ? '' : 's'} · share of tokens`}>
      {clients.length === 0 ? (
        <div className="empty-state">No requests in this period.</div>
      ) : (
        <table className="dtable">
          <thead>
            <tr>
              <th>client</th>
              <th className="w-[38%]">share</th>
              <th className="num">tokens</th>
              <th className="num max-[700px]:hidden">requests</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const name = c.clientName
              return (
                <tr
                  key={name ?? '\u0000'}
                  className={cn(name != null && 'clickable-row', name != null && clickableRowFocusClass)}
                  {...(name != null
                    ? clickableRowProps(() => navigate({ to: '/requests', search: { client: name } }))
                    : {})}
                >
                  <td className={cn('mono max-w-0 truncate', name == null && 'text-fg-dim italic')} translate="no">
                    {name ?? 'unattributed'}
                  </td>
                  <td>
                    <UsageShareBar part={c.totalTokens} total={total} />
                  </td>
                  <td className="num">{formatTokens(c.totalTokens)}</td>
                  <td className="num dim max-[700px]:hidden">{c.requests.toLocaleString('en')}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </UsagePanel>
  )
}
