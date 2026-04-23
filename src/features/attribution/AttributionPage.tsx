import { Check, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { TopBar } from '../../components/TopBar'
import { useAttributionSettings, useUpdateAttributionSettings } from '../../lib/queries'

export function AttributionPage() {
  const { data, isLoading } = useAttributionSettings()
  const update = useUpdateAttributionSettings()
  const [clientNameHeader, setClientNameHeader] = useState('')
  const [endUserIdHeader, setEndUserIdHeader] = useState('')
  const [sessionIdHeader, setSessionIdHeader] = useState('')

  useEffect(() => {
    if (!data) return
    setClientNameHeader(data.clientNameHeader ?? '')
    setEndUserIdHeader(data.endUserIdHeader ?? '')
    setSessionIdHeader(data.sessionIdHeader ?? '')
  }, [data])

  const isDirty =
    (data?.clientNameHeader ?? '') !== clientNameHeader ||
    (data?.endUserIdHeader ?? '') !== endUserIdHeader ||
    (data?.sessionIdHeader ?? '') !== sessionIdHeader

  return (
    <div className="main-col">
      <TopBar />
      <div className="content">
        <div className="page min-h-full flex-1 bg-surface-1">
          <PageHeader
            kicker="dsh · attribution"
            title="Attribution"
            subtitle="capture client, user, and session metadata from request headers"
            variant="integrated"
            action={
              data ? (
                <div className="flex items-center gap-2">
                  {update.isSuccess && !isDirty ? (
                    <span className="inline-flex items-center gap-1 rounded-sm border border-ok bg-ok-bg px-2 py-0.5 font-mono text-[11px] font-medium text-ok">
                      <Check size={14} strokeWidth={2} /> saved
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={!isDirty || update.isPending}
                    onClick={() =>
                      update.mutate({
                        clientNameHeader: clientNameHeader.trim() || null,
                        endUserIdHeader: endUserIdHeader.trim() || null,
                        sessionIdHeader: sessionIdHeader.trim() || null,
                      })
                    }
                  >
                    <Save size={14} strokeWidth={2} />
                    {update.isPending ? 'Saving…' : 'Save'}
                  </button>
                </div>
              ) : null
            }
          />

          {isLoading ? (
            <div className="empty-state px-6 max-md:px-3">loading attribution settings…</div>
          ) : (
            <div className="flex flex-col gap-0">
              <section className="panel !rounded-none !border-x-0 !bg-surface-1">
                <div className="panel-head bg-transparent px-6 max-md:px-3">
                  <span className="panel-title">Header mapping</span>
                  <span className="panel-sub">· map incoming request headers to normalized attribution fields</span>
                </div>
                <div className="grid gap-4 px-6 py-4 md:grid-cols-3 max-md:px-3">
                  <HeaderField
                    label="Client name"
                    helper="example: x-client-name"
                    value={clientNameHeader}
                    onChange={setClientNameHeader}
                  />
                  <HeaderField
                    label="End-user ID"
                    helper="example: x-end-user-id"
                    value={endUserIdHeader}
                    onChange={setEndUserIdHeader}
                  />
                  <HeaderField
                    label="Session ID"
                    helper="example: x-session-id"
                    value={sessionIdHeader}
                    onChange={setSessionIdHeader}
                  />
                </div>
                <div className="px-6 pb-4 font-mono text-[11px] text-fg-dim max-md:px-3">
                  Empty fields disable capture for that dimension. Values are trimmed and stored on each request row.
                  Client name falls back to a best-effort <code>user-agent</code> heuristic when no explicit client
                  header mapping is set.
                </div>
              </section>

              <section className="panel !rounded-none !border-x-0 !border-t-1 !bg-surface-1">
                <div className="panel-head bg-transparent px-6 max-md:px-3">
                  <span className="panel-title">Recommended conventions</span>
                  <span className="panel-sub">· suggested header names for new client setups</span>
                </div>
                <div className="grid gap-3 px-6 py-4 font-mono text-xs text-fg md:grid-cols-3 max-md:px-3">
                  <HeaderConvention
                    name="x-client-name"
                    description="stable client/app identifier like claude-code or home-assistant"
                  />
                  <HeaderConvention
                    name="x-end-user-id"
                    description="end user or account identifier if your client knows it"
                  />
                  <HeaderConvention
                    name="x-session-id"
                    description="conversation, run, or workflow session identifier"
                  />
                </div>
                <div className="px-6 pb-4 font-mono text-[11px] text-fg-dim max-md:px-3">
                  If client name is not explicitly mapped, llama-dash will try to infer it from <code>user-agent</code>{' '}
                  for a few known clients like Claude Code, OpenCode, Open WebUI, Home Assistant, curl, and
                  python-requests.
                </div>
              </section>

              <section className="panel !rounded-none !border-x-0 !border-t-1 !bg-surface-1">
                <div className="panel-head bg-transparent px-6 max-md:px-3">
                  <span className="panel-title">Setup examples</span>
                  <span className="panel-sub">
                    · add custom headers if your client does not already send suitable metadata
                  </span>
                </div>
                <div className="grid gap-4 px-6 py-4 max-md:px-3 lg:grid-cols-2">
                  <ExampleCard
                    title="curl"
                    code={`curl "$LLAMA_DASH/v1/chat/completions" \\
  -H "Authorization: Bearer sk-..." \\
  -H "Content-Type: application/json" \\
  -H "x-client-name: cli" \\
  -H "x-end-user-id: alice" \\
  -H "x-session-id: sess_123" \\
  -d '{"model":"gemma-4-26B-A4B-it","messages":[{"role":"user","content":"hello"}]}'`}
                  />
                  <ExampleCard
                    title="OpenCode"
                    code={`# configure custom headers in the client or wrapper
x-client-name: opencode
x-end-user-id: alice
x-session-id: run_456`}
                  />
                  <ExampleCard
                    title="Python / requests"
                    code={`requests.post(
  f"{base_url}/v1/chat/completions",
  headers={
    "Authorization": "Bearer sk-...",
    "x-client-name": "my-app",
    "x-end-user-id": user_id,
    "x-session-id": session_id,
  },
  json=payload,
)`}
                  />
                  <ExampleCard
                    title="Home Assistant / custom integration"
                    code={`# if using a custom component or proxy wrapper, add:
x-client-name: home-assistant
x-end-user-id: household_main
x-session-id: automation_abc`}
                  />
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function HeaderField({
  label,
  helper,
  value,
  onChange,
}: {
  label: string
  helper: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-fg-faint">{label}</span>
      <input
        className="h-9 border border-border bg-surface-3 px-3 font-mono text-xs text-fg"
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={helper}
      />
      <span className="text-[11px] font-mono text-fg-dim">{helper}</span>
    </label>
  )
}

function HeaderConvention({ name, description }: { name: string; description: string }) {
  return (
    <div className="border border-border bg-surface-0 px-4 py-3">
      <div className="text-info">{name}</div>
      <div className="mt-2 text-fg-dim">{description}</div>
    </div>
  )
}

function ExampleCard({ title, code }: { title: string; code: string }) {
  return (
    <section className="border border-border bg-surface-0">
      <div className="border-b border-border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-faint">
        {title}
      </div>
      <pre className="overflow-x-auto px-4 py-4 font-mono text-xs text-fg">{code}</pre>
    </section>
  )
}
