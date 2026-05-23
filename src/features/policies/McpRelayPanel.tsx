import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { CodeBlock } from '../../components/CodeBlock'
import { CopyableCode } from '../../components/CopyableCode'
import { Tooltip } from '../../components/Tooltip'

export function McpRelayPanel({
  relays,
  credentials,
  createPending,
  deletePending,
  onCreate,
  onDelete,
}: {
  relays: Array<{
    id: string
    name: string
    slug: string
    targetUrl: string
    credentialBindings: Array<{ credentialId: string; headerName: string }>
  }>
  credentials: Array<{ id: string; name: string; slug: string }>
  createPending: boolean
  deletePending: boolean
  onCreate: (body: { name: string; slug?: string; targetUrl: string; credentialId: string }) => void
  onDelete: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [targetUrl, setTargetUrl] = useState('')
  const [credentialId, setCredentialId] = useState('')
  const selectedCredentialId = credentialId || credentials[0]?.id || ''

  const submit = () => {
    if (!name.trim() || !targetUrl.trim() || !selectedCredentialId) return
    onCreate({
      name: name.trim(),
      slug: slug.trim() || undefined,
      targetUrl: targetUrl.trim(),
      credentialId: selectedCredentialId,
    })
    setName('')
    setSlug('')
    setTargetUrl('')
    setCredentialId('')
  }

  return (
    <section className="rounded-lg border border-border bg-surface-0 px-5 py-5 font-mono text-xs text-fg-dim">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.12em] text-fg-faint">MCP relays</span>
        <span className="text-[10px] uppercase tracking-[0.12em] text-fg-faint">
          · use /mcp-relays/&lt;slug&gt; with x-llama-dash-api-key
        </span>
      </div>
      <div className="grid gap-2 xl:grid-cols-[minmax(0,160px)_minmax(0,160px)_minmax(0,1fr)_minmax(0,180px)_auto]">
        <input
          type="text"
          className="h-9 rounded border border-border bg-surface-3 px-3 font-mono text-xs text-fg focus-visible:outline-none focus-visible:shadow-focus"
          placeholder="Relay name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <input
          type="text"
          className="h-9 rounded border border-border bg-surface-3 px-3 font-mono text-xs text-fg focus-visible:outline-none focus-visible:shadow-focus"
          placeholder="slug (optional)"
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
        />
        <input
          type="url"
          className="h-9 rounded border border-border bg-surface-3 px-3 font-mono text-xs text-fg focus-visible:outline-none focus-visible:shadow-focus"
          placeholder="https://mcp.notion.com/mcp"
          value={targetUrl}
          onChange={(event) => setTargetUrl(event.target.value)}
        />
        <select
          className="h-9 rounded border border-border bg-surface-3 px-3 font-mono text-xs text-fg focus-visible:outline-none focus-visible:shadow-focus"
          value={selectedCredentialId}
          onChange={(event) => setCredentialId(event.target.value)}
          disabled={credentials.length === 0}
        >
          {credentials.length === 0 ? <option value="">No credentials</option> : null}
          {credentials.map((credential) => (
            <option key={credential.id} value={credential.id}>
              {credential.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-primary h-9 px-3 text-xs"
          onClick={submit}
          disabled={createPending || !name.trim() || !targetUrl.trim() || !selectedCredentialId}
        >
          add relay
        </button>
      </div>
      <div className="mt-4 overflow-hidden rounded border border-border bg-surface-1">
        {relays.length === 0 ? (
          <div className="px-3 py-3 text-fg-faint">No MCP relays configured.</div>
        ) : (
          <div className="divide-y divide-border">
            <div className="grid grid-cols-[minmax(130px,0.8fr)_minmax(220px,1fr)_minmax(260px,1.4fr)_minmax(140px,0.8fr)_40px] items-center gap-x-4 bg-surface-0 px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-fg-faint max-lg:hidden">
              <span>Name</span>
              <span>Relay URL</span>
              <span>Target</span>
              <span>Credential</span>
              <span className="text-center">Action</span>
            </div>
            {relays.map((relay) => {
              const binding = relay.credentialBindings[0]
              const credential = credentials.find((item) => item.id === binding?.credentialId)
              return (
                <div
                  key={relay.id}
                  className="grid gap-2 px-3 py-2.5 lg:grid-cols-[minmax(130px,0.8fr)_minmax(220px,1fr)_minmax(260px,1.4fr)_minmax(140px,0.8fr)_40px] lg:items-center lg:gap-x-4"
                >
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-fg-faint lg:hidden">Name</div>
                    <div className="truncate text-fg">{relay.name}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-fg-faint lg:hidden">
                      Relay URL
                    </div>
                    <CopyableCode text={`/mcp-relays/${relay.slug}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-fg-faint lg:hidden">Target</div>
                    <div className="truncate text-fg-dim">{relay.targetUrl}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-fg-faint lg:hidden">Credential</div>
                    <div className="truncate text-fg-faint">{credential?.name ?? binding?.credentialId ?? '—'}</div>
                  </div>
                  <Tooltip label="Delete MCP relay" side="top">
                    <button
                      type="button"
                      className="inline-flex size-8 items-center justify-center justify-self-start rounded text-fg-faint transition-colors hover:bg-surface-3 hover:text-err focus-visible:outline-none focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-40 lg:justify-self-center"
                      onClick={() => onDelete(relay.id)}
                      disabled={deletePending}
                      aria-label={`Delete MCP relay ${relay.name}`}
                    >
                      <Trash2 className="size-3.5" strokeWidth={2} aria-hidden="true" />
                    </button>
                  </Tooltip>
                  <div className="min-w-0 lg:col-span-5">
                    <CodeBlock title="Claude Code MCP config" lang="json" text={claudeCodeMcpConfig(relay.slug)} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

function claudeCodeMcpConfig(slug: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        [slug]: {
          type: 'http',
          url: `http://<llama-dash-host>:5173/mcp-relays/${slug}`,
          headers: {
            'x-llama-dash-api-key': 'sk-...',
          },
        },
      },
    },
    null,
    2,
  )
}
