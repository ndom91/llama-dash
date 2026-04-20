import { Check, Clipboard } from 'lucide-react'
import { useState } from 'react'
import { cn } from '../../lib/cn'
import { maskSensitive, tryPrettyJson } from './requestDetailUtils'
import { RequestJsonHighlight } from './RequestJsonHighlight'

type Props = {
  title: string
  subtitle: string
  body: string
  headers: Record<string, string> | null
  mode: 'pretty' | 'raw'
}

export function RequestPayloadPane({ title, subtitle, body, headers, mode }: Props) {
  const [copied, setCopied] = useState(false)
  const pretty = mode === 'pretty' ? tryPrettyJson(body) : null
  const display = pretty ?? body
  const headerEntries = headers ? Object.entries(headers) : []

  const onCopy = () => {
    navigator.clipboard.writeText(body)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <section className="request-payload-pane">
      <div className="request-payload-head">
        <span className="panel-title">{title}</span>
        <span className="panel-sub">{subtitle}</span>
        <div className="request-payload-modes">
          <span className={cn('request-payload-mode', mode === 'pretty' && 'is-active')}>pretty</span>
          <span className={cn('request-payload-mode', mode === 'raw' && 'is-active')}>raw</span>
        </div>
        <button type="button" className="btn btn-ghost btn-xs" style={{ marginLeft: 'auto' }} onClick={onCopy}>
          <span className={cn('copy-icon-swap', copied && 'copy-icon-swap-done')}>
            <Clipboard className="copy-icon-swap-from icon-btn-12" strokeWidth={2} aria-hidden="true" />
            <Check className="copy-icon-swap-to icon-btn-12" strokeWidth={2} aria-hidden="true" />
          </span>
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
      <pre className="body-pre request-payload-pre">{pretty ? <RequestJsonHighlight json={display} /> : display}</pre>
      {headerEntries.length > 0 ? (
        <div className="request-payload-headers">
          <div className="request-payload-headers-title">Headers</div>
          <table className="dtable headers-table">
            <tbody>
              {headerEntries.map(([k, v]) => (
                <tr key={k}>
                  <td className="mono header-key">{k}</td>
                  <td className="mono">{maskSensitive(k, v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}
