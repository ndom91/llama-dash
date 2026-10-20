import { Tooltip } from '../../components/Tooltip'
import type { ApiUsageModel } from '../../lib/api'
import { cn } from '../../lib/cn'
import { UsagePanel } from './UsagePanel'
import { formatTokens } from './usageUtils'

type Props = {
  models: Array<ApiUsageModel>
}

export function UsageModelsPanel({ models }: Props) {
  return (
    <UsagePanel title="By model" sub={`${models.length} model${models.length === 1 ? '' : 's'}`}>
      {models.length === 0 ? (
        <div className="empty-state">No requests in this period.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="dtable">
            <thead>
              <tr>
                <th className="w-[40%]">model</th>
                <th className="num">generated</th>
                <th className="num max-[700px]:hidden">prompt</th>
                <th className="num">requests</th>
                <th className="num">
                  <Tooltip label="Generated tokens per second of wall time, successful streamed requests only (includes prefill)">
                    <span className="cursor-help underline decoration-dotted underline-offset-2">avg tok/s</span>
                  </Tooltip>
                </th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.model ?? '\u0000'}>
                  <td className={cn('mono max-w-0 truncate', m.model == null && 'text-fg-dim italic')} translate="no">
                    {m.model ?? 'unknown'}
                  </td>
                  <td className="num">{formatTokens(m.completionTokens)}</td>
                  <td className="num dim max-[700px]:hidden">{formatTokens(m.promptTokens)}</td>
                  <td className="num dim">
                    {m.requests.toLocaleString('en')}
                    {m.errors > 0 ? <span className="text-fg-faint"> · {m.errors} err</span> : null}
                  </td>
                  <td className="num">{m.avgGenTokPerSec != null ? m.avgGenTokPerSec.toFixed(1) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </UsagePanel>
  )
}
