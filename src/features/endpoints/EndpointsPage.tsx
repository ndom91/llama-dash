import { useEffect, useMemo, useState } from 'react'
import { CopyableCode } from '../../components/CopyableCode'
import { PageHeader } from '../../components/PageHeader'
import { cn } from '../../lib/cn'
import { useApiKeys } from '../../lib/queries'
import { EndpointExamples } from './EndpointExamples'

export function EndpointsPage() {
  const { data: keys, isPending: keysPending } = useApiKeys()
  const [selectedKeyIdx, setSelectedKeyIdx] = useState(0)

  // Read the origin after mount: SSR has no window, and hydration keeps the
  // server's placeholder text, so reloads would show the wrong URL.
  const [baseUrl, setBaseUrl] = useState('http://localhost:5173')
  useEffect(() => setBaseUrl(window.location.origin), [])
  const activeKeys = useMemo(() => (keys ?? []).filter((k) => !k.disabledAt), [keys])
  const hasKeys = activeKeys.length > 0
  // Keep the panel mounted while keys load so it doesn't pop in and reflow the grid.
  const showKeyPanel = keysPending || hasKeys
  const keyDisplay = hasKeys ? `${activeKeys[selectedKeyIdx]?.keyPrefix}…` : 'sk-your-key-here'

  return (
    <div className="content [scrollbar-gutter:stable]">
      <div className="page flex-1 bg-surface-1">
        <PageHeader
          kicker="dsh · endpoints"
          title="Endpoints"
          subtitle="connect clients to llama-dash"
          variant="integrated"
        />

        <div className={cn('grid gap-0', showKeyPanel && 'grid-cols-1 md:grid-cols-2')}>
          <section className="panel flex flex-col !rounded-none !border-x-0 !bg-surface-1">
            <div className="panel-head bg-transparent px-6 max-md:px-3">
              <span className="panel-title">Base URL</span>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <CopyableCode text={`${baseUrl}/v1`} size="l" />
              <p className="text-xs text-fg-dim font-mono m-0">
                All OpenAI-compatible endpoints live under <code className="text-fg-muted">/v1</code>. Point any client
                that speaks the OpenAI API at this URL.
              </p>
            </div>
          </section>

          {showKeyPanel ? (
            <section className="panel flex flex-col !rounded-none !border-x-0 !bg-surface-1 md:border-l md:border-l-border">
              <div className="panel-head bg-transparent px-6 max-md:px-3">
                <span className="panel-title">API Key</span>
                <span className="panel-sub">· used in examples below</span>
              </div>
              <div className="p-4 flex flex-col gap-3">
                <select
                  className="select-native w-full cursor-pointer rounded border border-border bg-surface-3 px-2 py-1.5 font-mono text-xs text-fg disabled:cursor-default disabled:text-fg-dim"
                  value={keysPending ? '' : selectedKeyIdx}
                  onChange={(e) => setSelectedKeyIdx(Number(e.target.value))}
                  disabled={keysPending}
                  aria-busy={keysPending}
                >
                  {keysPending ? (
                    <option value="">loading keys…</option>
                  ) : (
                    activeKeys.map((k, i) => (
                      <option key={k.id} value={i}>
                        {k.name} ({k.keyPrefix}…)
                      </option>
                    ))
                  )}
                </select>
                <p className="text-xs text-fg-dim font-mono m-0">
                  Key prefixes shown for reference. Use your full key value in the Authorization header.
                </p>
              </div>
            </section>
          ) : null}
        </div>

        <EndpointExamples baseUrl={baseUrl} apiKey={keyDisplay} />
      </div>
    </div>
  )
}
