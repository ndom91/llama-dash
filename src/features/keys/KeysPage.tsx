import { Plus } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { TopBar } from '../../components/TopBar'
import type { ApiKeyCreated } from '../../lib/api'
import { cn } from '../../lib/cn'
import { useApiKeys } from '../../lib/queries'
import { CreateKeyForm } from './CreateKeyForm'
import { KeyCreatedBanner } from './KeyCreatedBanner'
import { KeyRow } from './KeyRow'
import { KeysEmptyState } from './KeysEmptyState'
import { KeysPageSkeleton } from './KeysPageSkeleton'

export function KeysPage() {
  const { data: keys, error, isLoading } = useApiKeys()
  const [showCreate, setShowCreate] = useState(false)
  const [created, setCreated] = useState<ApiKeyCreated | null>(null)

  return (
    <div className="main-col">
      <TopBar />
      <div className="content">
        <div className="page min-h-full flex-1 bg-surface-1">
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

          {error ? <div className="err-banner mx-6 mt-3 max-md:mx-3">{error.message}</div> : null}
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

          <section
            className={cn(
              'panel flex min-h-0 flex-1 flex-col !rounded-none !border-x-0 !bg-surface-1',
              showCreate && 'border-t',
            )}
          >
            {isLoading ? (
              <KeysPageSkeleton />
            ) : !keys || keys.length === 0 ? (
              <KeysEmptyState />
            ) : (
              <table className="dtable">
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
