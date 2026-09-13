import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { RouteError } from '../../components/RouteError'
import type { ApiKeyCreated } from '../../lib/api'
import { cn } from '../../lib/cn'
import { useApiKeys, useModels } from '../../lib/queries'
import { CreateKeyForm } from './CreateKeyForm'
import { KeyCreatedBanner } from './KeyCreatedBanner'
import { KeyRow } from './KeyRow'
import { KeysEmptyState } from './KeysEmptyState'
import { KeysPageSkeleton } from './KeysPageSkeleton'

const CREATE_FORM_EXIT_TIMEOUT_MS = 400

export function KeysPage() {
  const { data: keys, error, isLoading } = useApiKeys()
  const { data: models } = useModels()
  const [showCreate, setShowCreate] = useState(false)
  const [renderCreate, setRenderCreate] = useState(false)
  const [createFormKey, setCreateFormKey] = useState(0)
  const [created, setCreated] = useState<ApiKeyCreated | null>(null)

  useEffect(() => {
    if (showCreate || !renderCreate) return
    const timeout = window.setTimeout(() => setRenderCreate(false), CREATE_FORM_EXIT_TIMEOUT_MS)
    return () => window.clearTimeout(timeout)
  }, [renderCreate, showCreate])

  function openCreate() {
    setCreateFormKey((key) => key + 1)
    setRenderCreate(true)
    setShowCreate(true)
  }

  if (error) {
    return <RouteError kicker="dsh · keys" title="Failed to load API keys" message={error.message} />
  }

  return (
    <div className="content">
      <div className="page min-h-full flex-1 bg-surface-1">
        <PageHeader
          kicker="dsh · keys"
          title="API Keys"
          subtitle="manage proxy authentication and rate limits"
          variant="integrated"
          action={
            <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
              <Plus size={14} strokeWidth={2} />
              Create key
            </button>
          }
        />

        {created ? <KeyCreatedBanner created={created} onDismiss={() => setCreated(null)} /> : null}
        {renderCreate ? (
          <CreateKeyForm
            key={createFormKey}
            open={showCreate}
            onCreated={(result) => {
              setCreated(result)
              setShowCreate(false)
            }}
            onCancel={() => setShowCreate(false)}
            onExited={() => setRenderCreate(false)}
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
                  <th className="hide-mobile">expires</th>
                  <th className="hide-mobile">created</th>
                  <th style={{ width: 90 }} className="num">
                    actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <KeyRow key={k.id} apiKey={k} modelIds={models?.map((model) => model.id)} />
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  )
}
