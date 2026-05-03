import { AlertTriangle, AlignLeft, Check, Loader2, RefreshCw, Save } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { parseDocument } from 'yaml'
import { PageHeader } from '../../components/PageHeader'
import { TopBar } from '../../components/TopBar'
import { api, type ApiConfigSaveResult } from '../../lib/api'
import { useSystemStatus } from '../../lib/queries'
import { YamlEditor } from './YamlEditor'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'unavailable' }
  | { status: 'ready'; original: string; modifiedAt: number }

export function ConfigPage() {
  const { data: system } = useSystemStatus()
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' })
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [validating, setValidating] = useState(false)
  const [validation, setValidation] = useState<{ valid: boolean; errors?: Array<string> } | null>(null)
  const [saveResult, setSaveResult] = useState<ApiConfigSaveResult | null>(null)
  const latestContentRef = useRef(content)

  useEffect(() => {
    latestContentRef.current = content
  }, [content])

  const isDirty = loadState.status === 'ready' && content !== loadState.original
  const configUnsupported = system?.inference.capabilities.config === false

  const load = useCallback(async () => {
    if (configUnsupported) {
      setLoadState({ status: 'unavailable' })
      return
    }
    setLoadState({ status: 'loading' })
    setSaveResult(null)
    setValidation(null)
    try {
      const data = await api.getConfig()
      setContent(data.content)
      setLoadState({ status: 'ready', original: data.content, modifiedAt: data.modifiedAt })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('404') || msg.includes('501')) setLoadState({ status: 'unavailable' })
      else setLoadState({ status: 'error', message: msg })
    }
  }, [configUnsupported])

  useEffect(() => {
    load()
  }, [load])

  const handleContentChange = useCallback((next: string) => {
    setContent(next)
    setValidation(null)
    setSaveResult(null)
  }, [])

  const doValidate = useCallback(async () => {
    if (loadState.status !== 'ready' || saving || validating) return
    const snapshot = content
    setValidating(true)
    setSaveResult(null)
    try {
      const result = await api.validateConfig(snapshot)
      if (latestContentRef.current !== snapshot) return
      setValidation(result)
    } finally {
      setValidating(false)
    }
  }, [content, loadState.status, saving, validating])

  const doSave = useCallback(async () => {
    if (loadState.status !== 'ready' || saving || validating) return
    const snapshot = content
    setSaving(true)
    setSaveResult(null)

    try {
      const v = await api.validateConfig(snapshot)
      if (latestContentRef.current !== snapshot) return
      setValidation(v)
      if (!v.valid) return

      const result = await api.saveConfig(snapshot, loadState.modifiedAt)
      if (latestContentRef.current !== snapshot) return
      setSaveResult(result)
      if (result.saved) {
        setLoadState({ status: 'ready', original: snapshot, modifiedAt: result.modifiedAt })
        setValidation(null)
      } else if (result.errors) {
        setValidation({ valid: false, errors: result.errors })
      }
    } finally {
      setSaving(false)
    }
  }, [content, loadState, saving, validating])

  const doFormat = useCallback(() => {
    try {
      const doc = parseDocument(content)
      if (doc.errors.length > 0) {
        setValidation({ valid: false, errors: doc.errors.map((e) => e.message) })
        return
      }
      setContent(doc.toString({ indent: 2, lineWidth: 0 }))
      setValidation(null)
      setSaveResult(null)
    } catch (err) {
      console.warn('Format failed:', err)
    }
  }, [content])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        doSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [doSave])

  return (
    <div className="main-col">
      <TopBar />
      <div className="content">
        <div className="page min-h-full flex-1">
          <PageHeader
            kicker="dsh · config"
            title="Configuration"
            subtitle={
              configUnsupported
                ? `${system.inference.label} does not expose editable runtime configuration through llama-dash.`
                : 'edit the inference backend configuration'
            }
            variant="integrated"
            action={
              loadState.status === 'ready' ? (
                <div className="flex items-center gap-2 max-md:w-full max-md:flex-wrap">
                  {isDirty ? (
                    <span className="inline-flex items-center rounded-sm border border-warn bg-warn-bg px-2 py-0.5 font-mono text-[11px] font-medium text-warn animate-[badge-in_var(--duration-normal)_var(--ease-out)]">
                      unsaved
                    </span>
                  ) : null}
                  {saveResult && 'saved' in saveResult && saveResult.saved ? (
                    <span className="inline-flex items-center gap-1 rounded-sm border border-ok bg-ok-bg px-2 py-0.5 font-mono text-[11px] font-medium text-ok animate-[badge-in_var(--duration-normal)_var(--ease-out)]">
                      <Check size={14} strokeWidth={2} /> saved
                    </span>
                  ) : null}
                  {validation?.valid ? (
                    <span className="inline-flex items-center gap-1 rounded-sm border border-ok bg-ok-bg px-2 py-0.5 font-mono text-[11px] font-medium text-ok animate-[badge-in_var(--duration-normal)_var(--ease-out)]">
                      <Check size={14} strokeWidth={2} /> valid
                    </span>
                  ) : null}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={doFormat}>
                    <AlignLeft size={14} strokeWidth={2} />
                    Format
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={saving || validating}
                    onClick={doValidate}
                  >
                    {validating ? (
                      <Loader2 size={14} className="spin" strokeWidth={2} />
                    ) : (
                      <Check size={14} strokeWidth={2} />
                    )}
                    Validate
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={load}>
                    <RefreshCw size={14} strokeWidth={2} />
                    Reload
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={!isDirty || saving || validating}
                    onClick={doSave}
                  >
                    {saving ? (
                      <Loader2 size={14} className="spin" strokeWidth={2} />
                    ) : (
                      <Save size={14} strokeWidth={2} />
                    )}
                    Save
                  </button>
                </div>
              ) : null
            }
          />

          {loadState.status === 'loading' ? (
            <div className="empty-state px-6 max-md:px-3">loading config…</div>
          ) : loadState.status === 'unavailable' ? (
            <div className="empty-state px-6 max-md:px-3">
              {configUnsupported ? (
                'The active inference backend does not support config editing yet.'
              ) : (
                <>
                  <code>INFERENCE_CONFIG_FILE</code> is not set. Set it to the path of your backend config file to
                  enable editing.
                </>
              )}
            </div>
          ) : loadState.status === 'error' ? (
            <div className="err-banner mx-6 mt-3 max-md:mx-3">{loadState.message}</div>
          ) : (
            <>
              {saveResult && 'conflict' in saveResult && saveResult.conflict ? (
                <div className="err-banner mx-6 mt-3 max-md:mx-3">
                  <AlertTriangle size={14} strokeWidth={2} /> Config was modified externally. Reload to get latest
                  version.
                  <button type="button" className="btn btn-ghost btn-xs" style={{ marginLeft: 8 }} onClick={load}>
                    Reload
                  </button>
                </div>
              ) : null}

              {validation && !validation.valid && validation.errors ? (
                <div className="mx-6 mt-3 mb-3 rounded-sm border border-err bg-err-bg px-3.5 py-2.5 text-[13px] text-err animate-[badge-in_var(--duration-slow)_var(--ease-out)] max-md:mx-3">
                  <strong>Validation errors:</strong>
                  <ul className="mt-1.5 pl-[18px]">
                    {validation.errors.map((e) => (
                      <li key={e} className="font-mono text-xs">
                        {e}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="panel flex min-h-0 flex-1 flex-col overflow-hidden !rounded-none !border-x-0 !bg-surface-1 border-border-strong">
                <YamlEditor value={content} onChange={handleContentChange} />
                <div className="border-t border-border bg-surface-3 px-3.5 py-2 text-xs text-fg-dim">
                  <kbd>Cmd+S</kbd> to save · Tab inserts 2 spaces · llama-swap auto-reloads on file change
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
