import { useMemo, useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { TopBar } from '../../components/TopBar'
import { useApiKeys, useModels } from '../../lib/queries'
import { CodeExample } from './CodeExample'
import { CopyBlock } from './CopyBlock'
import { ENDPOINT_TABS, type EndpointTab } from './snippets'

export function EndpointsPage() {
  const { data: keys } = useApiKeys()
  const { data: models } = useModels()
  const [tab, setTab] = useState<EndpointTab>('curl')
  const [selectedKeyIdx, setSelectedKeyIdx] = useState(0)

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'
  const activeKeys = useMemo(() => (keys ?? []).filter((k) => !k.disabledAt), [keys])
  const hasKeys = activeKeys.length > 0
  const keyDisplay = hasKeys ? `${activeKeys[selectedKeyIdx]?.keyPrefix}…` : 'sk-your-key-here'
  const firstModel = models?.[0]?.id ?? 'your-model'

  return (
    <div className="main-col">
      <TopBar />
      <div className="content">
        <div className="page endpoints-page">
          <PageHeader
            kicker="dsh · endpoints"
            title="Endpoints"
            subtitle="connect clients to llama-dash"
            variant="integrated"
          />

          <div className={`grid endpoints-grid ${hasKeys ? 'grid-cols-1 md:grid-cols-2' : ''}`}>
            <section className="panel endpoints-panel">
              <div className="panel-head endpoints-panel-head">
                <span className="panel-title">Base URL</span>
              </div>
              <div className="p-4 flex flex-col gap-3">
                <CopyBlock text={`${baseUrl}/v1`} inline />
                <p className="text-xs text-fg-dim font-mono m-0">
                  All OpenAI-compatible endpoints live under <code className="text-fg-muted">/v1</code>. Point any
                  client that speaks the OpenAI API at this URL.
                </p>
              </div>
            </section>

            {hasKeys ? (
              <section className="panel endpoints-panel">
                <div className="panel-head endpoints-panel-head">
                  <span className="panel-title">API Key</span>
                  <span className="panel-sub">· used in examples below</span>
                </div>
                <div className="p-4 flex flex-col gap-3">
                  <select
                    className="bg-surface-3 border border-border rounded px-2 py-1.5 font-mono text-xs text-fg cursor-pointer"
                    value={selectedKeyIdx}
                    onChange={(e) => setSelectedKeyIdx(Number(e.target.value))}
                  >
                    {activeKeys.map((k, i) => (
                      <option key={k.id} value={i}>
                        {k.name} ({k.keyPrefix}…)
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-fg-dim font-mono m-0">
                    Key prefixes shown for reference. Use your full key value in the Authorization header.
                  </p>
                </div>
              </section>
            ) : null}
          </div>

          <section className="panel endpoints-panel endpoints-code-panel">
            <div className="panel-head endpoints-panel-head">
              <span className="panel-title">Code examples</span>
              <span className="panel-sub">· {ENDPOINT_TABS.find((t) => t.id === tab)?.label}</span>
            </div>
            <div className="flex border-b border-border overflow-x-auto">
              {ENDPOINT_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`px-4 py-2 text-xs font-mono cursor-pointer border-b-2 transition-colors ${
                    tab === t.id
                      ? 'border-accent text-fg bg-transparent'
                      : 'border-transparent text-fg-muted bg-transparent hover:text-fg hover:bg-surface-2'
                  }`}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="p-4">
              <CodeExample tab={tab} baseUrl={baseUrl} apiKey={keyDisplay} model={firstModel} />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
