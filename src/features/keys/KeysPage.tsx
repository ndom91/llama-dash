import { Plus } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { TopBar } from '../../components/TopBar'
import type { ApiKeyCreated } from '../../lib/api'
import { useApiKeys } from '../../lib/queries'
import { CreateKeyForm } from './CreateKeyForm'
import { KeyCreatedBanner } from './KeyCreatedBanner'
import { KeyRow } from './KeyRow'
import { KeysEmptyState } from './KeysEmptyState'

export function KeysPage() {
  const { data: keys, error, isLoading } = useApiKeys()
  const [showCreate, setShowCreate] = useState(false)
  const [created, setCreated] = useState<ApiKeyCreated | null>(null)

  return (
    <div className="main-col">
      <TopBar />
      <div className="content">
        <div className="page keys-page">
          <PageHeader
            kicker="dsh · keys"
            title="API Keys"
            subtitle="manage proxy authentication and rate limits"
            variant="integrated"
            action={
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
                <Plus size={14} strokeWidth={2} />
                Create key
              </button>
            }
          />

          {error ? <div className="err-banner keys-error-banner">{error.message}</div> : null}
          {created ? <KeyCreatedBanner created={created} onDismiss={() => setCreated(null)} /> : null}
          {showCreate ? (
            <CreateKeyForm
              onCreated={(result) => {
                setCreated(result)
                setShowCreate(false)
              }}
              onCancel={() => setShowCreate(false)}
            />
          ) : null}

          <section className="panel keys-panel">
            {isLoading ? (
              <div className="empty-state keys-empty-state">loading…</div>
            ) : !keys || keys.length === 0 ? (
              <KeysEmptyState />
            ) : (
              <table className="dtable keys-table">
                <thead>
                  <tr>
                    <th style={{ width: 18 }} aria-label="status" />
                    <th>name</th>
                    <th className="mono">prefix</th>
                    <th className="hide-mobile">models</th>
                    <th className="num hide-mobile">rpm</th>
                    <th className="num hide-mobile">tpm</th>
                    <th className="hide-mobile">created</th>
                    <th style={{ width: 90 }} className="num">
                      actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k) => (
                    <KeyRow key={k.id} apiKey={k} />
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
