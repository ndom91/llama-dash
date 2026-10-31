import { Check, CircleAlert, ExternalLink, Plug, Unplug } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { CopyableCode } from '../../components/CopyableCode'
import { cn } from '../../lib/cn'
import { PROVIDER_ENDPOINTS, PROVIDER_TARGETS, type ProviderTarget } from '../../lib/providers'
import { Chip } from './routing-ui'

type ConnectionRow = {
  targetId: string
  targetLabel: string
  credentialName: string
  models: string[]
  modelsDiscoveredAt: string | null
  enabled: boolean
}

export function ProvidersPanel({
  connections,
  vaultEnabled,
  connectPending,
  disconnectPending,
  testPending,
  testResult,
  onConnect,
  onDisconnect,
  onTest,
}: {
  connections: ConnectionRow[]
  vaultEnabled: boolean
  connectPending: boolean
  disconnectPending: boolean
  testPending: boolean
  testResult?: { targetId: string; ok: boolean; message: string; latencyMs: number; models: string[] }
  onConnect: (body: { targetId: string; apiKey: string }) => void
  onDisconnect: (targetId: string) => void
  onTest: (body: { targetId: string; apiKey?: string }) => void
}) {
  const [targetId, setTargetId] = useState(PROVIDER_TARGETS[0]?.id ?? '')
  const [apiKey, setApiKey] = useState('')
  const target = PROVIDER_TARGETS.find((item) => item.id === targetId)

  return (
    <div className="space-y-4">
      {!vaultEnabled ? (
        <div className="rounded border border-warn/40 bg-warn/10 px-3 py-2 text-[11px] text-warn">
          <code className="font-mono">CREDENTIAL_ENCRYPTION_KEY</code> is not set or shorter than 32 characters — set it
          in <code className="font-mono">.env</code> and restart so provider keys are stored encrypted in the credential
          vault.
        </div>
      ) : null}

      {/* Connect: one target, one key, every API surface at once. */}
      <section className="rounded-lg border border-border bg-surface-1 px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-accent">Connect a subscription</span>
          <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-fg-faint">
            · one key wires every API surface of the target
          </span>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_auto_auto]">
          <select
            className="h-9 rounded border border-border bg-surface-3 px-3 font-mono text-xs text-fg focus-visible:outline-none focus-visible:shadow-focus"
            value={targetId}
            onChange={(event) => setTargetId(event.target.value)}
          >
            {PROVIDER_TARGETS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <input
            type="password"
            className="h-9 rounded border border-border bg-surface-3 px-3 font-mono text-xs text-fg focus-visible:outline-none focus-visible:shadow-focus"
            placeholder="provider API key"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            autoComplete="off"
          />
          <button
            type="button"
            className="btn btn-primary h-9"
            disabled={!apiKey.trim() || connectPending}
            onClick={() => {
              onConnect({ targetId, apiKey: apiKey.trim() })
              setApiKey('')
            }}
          >
            <Plug size={12} className="mr-1 inline-block" aria-hidden="true" />
            {connectPending ? 'connecting…' : 'connect'}
          </button>
          <button
            type="button"
            className="btn btn-ghost h-9"
            disabled={testPending || !apiKey.trim()}
            onClick={() => onTest({ targetId, apiKey: apiKey.trim() || undefined })}
          >
            {testPending ? 'testing…' : 'test key'}
          </button>
        </div>
        {target ? <TargetMeta target={target} /> : null}
        {testResult ? <TestResultBanner result={testResult} /> : null}
      </section>

      {/* Connected targets. */}
      {connections.map((connection) => {
        const rowTarget = PROVIDER_TARGETS.find((item) => item.id === connection.targetId)
        const surfaces = PROVIDER_ENDPOINTS.filter((endpoint) => endpoint.targetId === connection.targetId)
        return (
          <section
            key={connection.targetId}
            className={cn(
              'rounded-lg border bg-surface-1 px-4 py-4',
              connection.enabled ? 'border-ok/40' : 'border-border',
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Check size={13} className="text-ok" aria-hidden="true" />
                <span className="font-mono text-xs text-fg">{connection.targetLabel}</span>
                {surfaces.map((surface) => (
                  <Chip key={surface.id} tone={surface.apiStyle === 'anthropic' ? 'info' : 'default'}>
                    {surface.apiStyle}
                  </Chip>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to="/cloud-models"
                  className="rounded-sm px-1.5 py-0.5 font-mono text-[11px] text-fg-dim transition-colors hover:text-fg"
                >
                  {connection.models.length} models
                </Link>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  disabled={testPending}
                  onClick={() => onTest({ targetId: connection.targetId })}
                >
                  <Plug size={11} className="mr-1 inline-block" aria-hidden="true" />
                  test
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  disabled={disconnectPending}
                  onClick={() => onDisconnect(connection.targetId)}
                >
                  <Unplug size={11} className="mr-1 inline-block" aria-hidden="true" />
                  disconnect
                </button>
              </div>
            </div>
            <div className="mt-2 font-mono text-[11px] text-fg-faint">
              {rowTarget ? rowTarget.origin : ''} · credential {connection.credentialName} ·{' '}
              {connection.modelsDiscoveredAt
                ? `models discovered ${new Date(connection.modelsDiscoveredAt).toLocaleString()}`
                : 'models not discovered yet'}
            </div>
            <div className="mt-3">
              <ProviderSnippet targetId={connection.targetId} model={connection.models[0]} />
            </div>
          </section>
        )
      })}
    </div>
  )
}

function TargetMeta({ target }: { target: ProviderTarget }) {
  return (
    <div className="mt-3 space-y-1.5 font-mono text-[11px] text-fg-dim">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-fg-faint">origin</span>
        <span>{target.origin}</span>
        <a
          href={target.consoleUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-fg-dim transition-colors hover:text-fg"
        >
          get key
          <ExternalLink size={10} aria-hidden="true" />
        </a>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-fg-faint">surfaces</span>
        {PROVIDER_ENDPOINTS.filter((endpoint) => endpoint.targetId === target.id).map((endpoint) => (
          <Chip key={endpoint.id} tone="default">
            {endpoint.baseUrl.replace(/^https?:\/\//, '')}
          </Chip>
        ))}
      </div>
      {target.note ? <div className="text-fg-faint">{target.note}</div> : null}
    </div>
  )
}

function TestResultBanner({
  result,
}: {
  result: { targetId: string; ok: boolean; message: string; latencyMs: number; models: string[] }
}) {
  return (
    <div
      className={cn(
        'mt-3 flex items-start gap-2 rounded border px-3 py-2 text-[11px]',
        result.ok ? 'border-ok/40 bg-ok/10 text-ok' : 'border-err/40 bg-err/10 text-err',
      )}
    >
      {result.ok ? null : <CircleAlert size={12} className="mt-0.5 shrink-0" aria-hidden="true" />}
      <span>
        {result.message}
        {result.ok && result.latencyMs > 0 ? ` · ${result.latencyMs}ms` : ''}
      </span>
    </div>
  )
}

/** Copy-paste setup for pointing a client at llswap-dash instead of the provider. */
function ProviderSnippet({ targetId, model }: { targetId: string; model?: string }) {
  const target = PROVIDER_TARGETS.find((item) => item.id === targetId)
  const hasAnthropic = PROVIDER_ENDPOINTS.some(
    (endpoint) => endpoint.targetId === targetId && endpoint.apiStyle === 'anthropic',
  )
  const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'
  const resolvedModel = model ?? 'your-model'
  const snippet = hasAnthropic
    ? [
        `export ANTHROPIC_BASE_URL=${base}`,
        'export ANTHROPIC_AUTH_TOKEN=sk-your-llswap-dash-key',
        `# model: ${resolvedModel}`,
      ].join('\n')
    : [
        `export OPENAI_BASE_URL=${base}/v1`,
        'export OPENAI_API_KEY=sk-your-llswap-dash-key',
        `# model: ${resolvedModel}`,
      ].join('\n')

  return (
    <div className="space-y-1.5">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-fg-faint">
        point your client at llswap-dash{target ? ` · ${target.planLabel}` : ''}
      </div>
      <CopyableCode text={snippet} size="m" />
    </div>
  )
}
