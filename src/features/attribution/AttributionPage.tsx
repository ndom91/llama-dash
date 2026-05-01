import { Check, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CodeBlock } from '../../components/CodeBlock'
import { PageHeader } from '../../components/PageHeader'
import { TopBar } from '../../components/TopBar'
import { useAttributionSettings, useUpdateAttributionSettings } from '../../lib/queries'

type HighlightLanguage = 'bash' | 'json' | 'jsonc' | 'python' | 'yaml'
type ExampleTab = (typeof EXAMPLE_TABS)[number]['id']

export function AttributionPage() {
  const { data, isLoading } = useAttributionSettings()
  const update = useUpdateAttributionSettings()
  const [clientNameHeader, setClientNameHeader] = useState('')
  const [endUserIdHeader, setEndUserIdHeader] = useState('')
  const [sessionIdHeader, setSessionIdHeader] = useState('')
  const [exampleTab, setExampleTab] = useState<ExampleTab>(EXAMPLE_TABS[0].id)

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
  const activeExample = EXAMPLE_TABS.find((tab) => tab.id === exampleTab) ?? EXAMPLE_TABS[0]

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
                <div className="border-border">
                  <div className="flex overflow-x-auto border-b border-border">
                    {EXAMPLE_TABS.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        className={`cursor-pointer border-b-2 bg-transparent px-4 py-2 font-mono text-xs transition-colors ${
                          exampleTab === tab.id
                            ? 'border-accent text-fg'
                            : 'border-transparent text-fg-muted hover:bg-surface-2 hover:text-fg'
                        }`}
                        onClick={() => setExampleTab(tab.id)}
                      >
                        {tab.title}
                      </button>
                    ))}
                  </div>
                  <div className="px-6 py-4 max-md:px-3">
                    <ExampleCard
                      title={activeExample.title}
                      code={activeExample.code}
                      language={activeExample.language}
                    />
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const EXAMPLE_TABS = [
  {
    id: 'curl',
    title: 'curl',
    language: 'bash',
    code: `curl "$LLAMA_DASH/v1/chat/completions" \\
  -H "Authorization: Bearer sk-..." \\
  -H "Content-Type: application/json" \\
  -H "x-client-name: cli" \\
  -H "x-end-user-id: alice" \\
  -H "x-session-id: sess_123" \\
  -d '{"model":"gemma-4-26B-A4B-it","messages":[{"role":"user","content":"hello"}]}'`,
  },
  {
    id: 'claude-code',
    title: 'Claude Code',
    language: 'json',
    code: `{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "env": {
    "ANTHROPIC_BASE_URL": "http://llama-dash.local:5173"
  }
}`,
  },
  {
    id: 'opencode',
    title: 'OpenCode',
    language: 'jsonc',
    code: `// ~/.config/opencode/opencode.jsonc
// Add headers under provider.<id>.options.headers.
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "llama-dash": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "llama-dash",
      "options": {
        "baseURL": "http://llama-dash.local:5173/v1",
        "headers": {
          "x-client-name": "opencode",
          "x-end-user-id": "alice",
          "x-session-id": "opencode-workstation"
        }
      },
      "models": {
        "gemma-4-26B-A4B-it": { "name": "Gemma 4 26B" }
      }
    }
  },
  "model": "llama-dash/gemma-4-26B-A4B-it"
}`,
  },
  {
    id: 'python',
    title: 'Python / requests',
    language: 'python',
    code: `requests.post(
  f"{base_url}/v1/chat/completions",
  headers={
    "Authorization": "Bearer sk-...",
    "x-client-name": "my-app",
    "x-end-user-id": user_id,
    "x-session-id": session_id,
  },
  json=payload,
)`,
  },
  {
    id: 'home-assistant',
    title: 'Home Assistant',
    language: 'yaml',
    code: `# configuration.yaml
# Built-in OpenAI/OpenRouter conversation integrations do not expose
# arbitrary headers. For YAML automations that call llama-dash directly,
# put attribution headers under rest_command.<name>.headers.
rest_command:
  llama_dash_chat:
    url: "http://llama-dash.local:5173/v1/chat/completions"
    method: POST
    content_type: "application/json"
    headers:
      authorization: "Bearer sk-..."
      x-client-name: "home-assistant"
      x-end-user-id: "household_main"
      x-session-id: "{{ context.id }}"
    payload: >-
      {
        "model": "gemma-4-26B-A4B-it",
        "messages": [{"role":"user","content":"{{ prompt }}"}]
      }`,
  },
] as const

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
    </label>
  )
}

function HeaderConvention({ name, description }: { name: string; description: string }) {
  return (
    <div className="border border-border bg-surface-0 px-4 py-3">
      <div className="text-accent">{name}</div>
      <div className="mt-2 text-fg-dim">{description}</div>
    </div>
  )
}

function ExampleCard({ title, code, language }: { title: string; code: string; language: HighlightLanguage }) {
  return <CodeBlock text={code} title={title} lang={language} />
}
