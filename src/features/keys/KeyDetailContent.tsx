import { Power, RotateCw } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { StatusDot } from '../../components/StatusDot'
import type { ApiKeyDetail } from '../../lib/api'
import { useRevokeApiKey } from '../../lib/queries'
import { KeyDefaultModelPanel } from './KeyDefaultModelPanel'
import { KeyModelAccessPanel } from './KeyModelAccessPanel'
import { KeyRequestsPanel } from './KeyRequestsPanel'
import { KeyStatsRow } from './KeyStatsRow'
import { KeySystemPromptPanel } from './KeySystemPromptPanel'
import { buildKeySnippet, formatRelative } from './keyUtils'

type Props = {
  data: ApiKeyDetail
}

export function KeyDetailContent({ data }: Props) {
  const { key, stats, requests, modelBreakdown } = data
  const isRevoked = key.disabledAt != null
  const revokeKey = useRevokeApiKey()
  const lastUsedAt = requests.rows[0]?.startedAt ?? null
  const scopedModels = key.allowedModels.length === 0 ? 'all' : `${key.allowedModels.length} of 5`

  return (
    <>
      <PageHeader
        kicker={`key · ${key.name}`}
        title={key.name}
        subtitle={
          <span translate="no">
            {key.keyPrefix}… · {isRevoked ? 'revoked' : 'active'} · created{' '}
            {new Date(key.createdAt).toLocaleDateString()}
          </span>
        }
        variant="integrated"
        action={
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-ghost btn-xs" disabled>
              <RotateCw size={12} strokeWidth={2} />
              rotate
            </button>
            <button
              type="button"
              className="btn btn-danger-ghost btn-xs"
              disabled={isRevoked || revokeKey.isPending}
              onClick={() => revokeKey.mutate(key.id)}
            >
              <Power size={12} strokeWidth={2} />
              revoke
            </button>
          </div>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)_350px] items-stretch gap-0 max-[1200px]:grid-cols-[240px_minmax(0,1fr)] max-[900px]:grid-cols-1">
        <aside className="border-r border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] bg-surface-1 px-3.5 py-4 max-[900px]:border-r-0 max-[900px]:border-b">
          <div>
            <div className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">Key</div>
            <dl className="grid gap-2 m-0">
              <div>
                <dt>status</dt>
                <dd>
                  <StatusDot tone={isRevoked ? 'idle' : 'ok'} live={!isRevoked} />
                  <span>{isRevoked ? 'revoked' : 'active'}</span>
                </dd>
              </div>
              <div>
                <dt>prefix</dt>
                <dd className="mono">{key.keyPrefix}…</dd>
              </div>
              <div>
                <dt>created</dt>
                <dd>{new Date(key.createdAt).toLocaleDateString()}</dd>
              </div>
              <div>
                <dt>last used</dt>
                <dd>{lastUsedAt ? formatRelative(lastUsedAt) : 'never'}</dd>
              </div>
            </dl>
          </div>

          <div className="mt-3.5 border-t border-[color:color-mix(in_srgb,var(--border)_72%,transparent)] pt-3.5">
            <div className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">Limits</div>
            <dl className="grid gap-2 m-0">
              <div>
                <dt>rpm</dt>
                <dd>{key.rateLimitRpm?.toLocaleString() ?? '—'}</dd>
              </div>
              <div>
                <dt>tpm</dt>
                <dd>{key.rateLimitTpm?.toLocaleString() ?? '—'}</dd>
              </div>
              <div>
                <dt>models</dt>
                <dd>{scopedModels}</dd>
              </div>
            </dl>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-col gap-0">
          <KeyStatsRow stats={stats} />
          <KeyDefaultModelPanel keyId={key.id} defaultModel={key.defaultModel} isRevoked={isRevoked} />
          <KeySystemPromptPanel keyId={key.id} systemPrompt={key.systemPrompt} isRevoked={isRevoked} />
          <KeyModelAccessPanel
            keyId={key.id}
            allowedModels={key.allowedModels}
            breakdown={modelBreakdown}
            isRevoked={isRevoked}
          />
          <KeyRequestsPanel rows={requests.rows} />
        </div>

        <aside className="bg-[color:color-mix(in_srgb,var(--bg-0)_92%,black_8%)] px-3.5 py-3 max-[1200px]:col-span-full max-[1200px]:border-t max-[1200px]:border-t-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
          <section>
            <div className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">Use this key</div>
            <pre className="m-0 whitespace-pre-wrap bg-[color:color-mix(in_srgb,var(--bg-1)_84%,var(--bg-2))] border border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] p-3 font-mono text-[11px] leading-[1.55] text-fg-dim">
              {buildKeySnippet(key.keyPrefix)}
            </pre>
          </section>

          <section className="mt-4 border-t border-[color:color-mix(in_srgb,var(--border)_72%,transparent)] pt-4">
            <div className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">Activity · 30m</div>
            <dl className="grid gap-2 m-0">
              <div>
                <dt>requests</dt>
                <dd>{stats.totalRequests}</dd>
              </div>
              <div>
                <dt>success</dt>
                <dd>{stats.totalRequests - stats.errorCount}</dd>
              </div>
              <div>
                <dt>errors</dt>
                <dd>{stats.errorCount}</dd>
              </div>
              <div>
                <dt>tokens</dt>
                <dd>{(stats.totalPromptTokens + stats.totalCompletionTokens).toLocaleString()}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </>
  )
}
