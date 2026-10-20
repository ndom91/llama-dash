import { useNavigate } from '@tanstack/react-router'
import type { ApiUsageKey } from '../../lib/api'
import { clickableRowFocusClass, clickableRowProps } from '../../lib/clickable-row-props'
import { cn } from '../../lib/cn'
import { UsagePanel } from './UsagePanel'
import { UsageShareBar } from './UsageShareBar'
import { formatTokens } from './usageUtils'

type Props = {
  keys: Array<ApiUsageKey>
}

function keyLabel(key: ApiUsageKey): string {
  if (key.keyId == null) return 'no key'
  return key.keyName ?? `deleted · ${key.keyId.slice(0, 8)}`
}

export function UsageKeysPanel({ keys }: Props) {
  const navigate = useNavigate()
  const total = keys.reduce((acc, k) => acc + k.totalTokens, 0)
  return (
    <UsagePanel title="By key" sub={`${keys.length} key${keys.length === 1 ? '' : 's'} · share of tokens`}>
      {keys.length === 0 ? (
        <div className="empty-state">No requests in this period.</div>
      ) : (
        <table className="dtable">
          <thead>
            <tr>
              <th>key</th>
              <th className="w-[38%]">share</th>
              <th className="num">tokens</th>
              <th className="num max-[700px]:hidden">requests</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => {
              const linkable = k.keyId != null && k.keyName != null
              const id = k.keyId
              return (
                <tr
                  key={k.keyId ?? '\u0000'}
                  className={cn(linkable && 'clickable-row', linkable && clickableRowFocusClass)}
                  {...(linkable && id != null
                    ? clickableRowProps(() => navigate({ to: '/keys/$id', params: { id } }))
                    : {})}
                >
                  <td className={cn('mono max-w-0 truncate', !linkable && 'text-fg-dim italic')} translate="no">
                    {keyLabel(k)}
                  </td>
                  <td>
                    <UsageShareBar part={k.totalTokens} total={total} />
                  </td>
                  <td className="num">{formatTokens(k.totalTokens)}</td>
                  <td className="num dim max-[700px]:hidden">{k.requests.toLocaleString('en')}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </UsagePanel>
  )
}
