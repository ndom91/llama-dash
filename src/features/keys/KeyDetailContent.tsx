import { Power, RotateCw } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { StatusDot } from '../../components/StatusDot'
import type { ApiKeyDetail } from '../../lib/api'
import { useModels, useRevokeApiKey } from '../../lib/queries'
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
  const { data: models } = useModels()
  const isRevoked = key.disabledAt != null
  const revokeKey = useRevokeApiKey()
  const lastUsedAt = requests.rows[0]?.startedAt ?? null
  const scopedModels =
    key.allowedModels.length === 0 ? 'all' : `${key.allowedModels.length} of ${models?.length ?? '—'}`

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

      <div className="detail-sidecar-shell">
        <aside className="detail-meta-rail">
          <div className="detail-meta-section">
            <div className="detail-meta-kicker">Key</div>
            <dl className="detail-meta-list">
              <div>
                <dt>status</dt>
                <dd>
                  <StatusDot tone={isRevoked ? 'idle' : 'ok'} live={!isRevoked} />
                  <span>{isRevoked ? 'revoked' : 'active'}</span>
                </dd>
              </div>
              <div>
                <dt>prefix</dt>
                <dd>
                  <span className="font-mono">{key.keyPrefix}…</span>
                </dd>
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

          <div className="detail-meta-section">
            <div className="detail-meta-kicker">Limits</div>
            <dl className="detail-meta-list">
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

        <div className="detail-main-stack">
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

        <aside className="detail-sidecar bg-surface-2">
          <section className="detail-sidecar-section">
            <div className="detail-sidecar-title">Use this key</div>
            <pre className="detail-sidecar-code">{buildKeySnippet(key.keyPrefix)}</pre>
          </section>

          <section className="detail-sidecar-section">
            <div className="detail-sidecar-title">Activity · 30m</div>
            <dl className="detail-sidecar-metrics">
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
