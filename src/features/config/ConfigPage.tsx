import { AlertTriangle, AlignLeft, Check, Loader2, RefreshCw, Save } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { parseDocument } from 'yaml'
import { PageHeader } from '../../components/PageHeader'
import { TopBar } from '../../components/TopBar'
import { api, type ApiConfigSaveResult } from '../../lib/api'
import { YamlEditor } from './YamlEditor'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'unavailable' }
  | { status: 'ready'; original: string; modifiedAt: number }

export function ConfigPage() {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' })
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [validation, setValidation] = useState<{ valid: boolean; errors?: Array<string> } | null>(null)
  const [saveResult, setSaveResult] = useState<ApiConfigSaveResult | null>(null)

  const isDirty = loadState.status === 'ready' && content !== loadState.original

  const load = useCallback(async () => {
    setLoadState({ status: 'loading' })
    setSaveResult(null)
    setValidation(null)
    try {
      const data = await api.getConfig()
      setContent(data.content)
      setLoadState({ status: 'ready', original: data.content, modifiedAt: data.modifiedAt })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('404')) setLoadState({ status: 'unavailable' })
      else setLoadState({ status: 'error', message: msg })
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const doSave = useCallback(async () => {
    if (loadState.status !== 'ready' || saving) return
    setSaving(true)
    setSaveResult(null)

    const v = await api.validateConfig(content)
    setValidation(v)
    if (!v.valid) {
      setSaving(false)
      return
    }

    const result = await api.saveConfig(content, loadState.modifiedAt)
    setSaveResult(result)
    setSaving(false)

    if (result.saved) {
      setLoadState({ status: 'ready', original: content, modifiedAt: result.modifiedAt })
      setValidation(null)
    }
  }, [content, loadState, saving])

  const doFormat = useCallback(() => {
    try {
      const doc = parseDocument(content)
      if (doc.errors.length > 0) {
        setValidation({ valid: false, errors: doc.errors.map((e) => e.message) })
        return
      }
      setContent(doc.toString({ indent: 2, lineWidth: 0 }))
      setValidation(null)
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
        <div className="page config-page">
          <PageHeader
            kicker="dsh · config"
            title="Configuration"
            subtitle="edit the llama-swap configuration"
            variant="integrated"
            action={
              loadState.status === 'ready' ? (
                <div className="config-header-actions">
                  {isDirty ? <span className="config-dirty-badge">unsaved</span> : null}
                  {saveResult && 'saved' in saveResult && saveResult.saved ? (
                    <span className="config-saved-badge">
                      <Check size={14} strokeWidth={2} /> saved
                    </span>
                  ) : null}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={doFormat}>
                    <AlignLeft size={14} strokeWidth={2} />
                    Format
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={load}>
                    <RefreshCw size={14} strokeWidth={2} />
                    Reload
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={!isDirty || saving}
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
            <div className="empty-state config-empty-state">loading config…</div>
          ) : loadState.status === 'unavailable' ? (
            <div className="empty-state config-empty-state">
              <code>LLAMASWAP_CONFIG_FILE</code> is not set. Set it to the path of your llama-swap config.yaml to enable
              editing.
            </div>
          ) : loadState.status === 'error' ? (
            <div className="err-banner config-error-banner">{loadState.message}</div>
          ) : (
            <>
              {saveResult && 'conflict' in saveResult && saveResult.conflict ? (
                <div className="err-banner config-error-banner">
                  <AlertTriangle size={14} strokeWidth={2} /> Config was modified externally. Reload to get latest
                  version.
                  <button type="button" className="btn btn-ghost btn-xs" style={{ marginLeft: 8 }} onClick={load}>
                    Reload
                  </button>
                </div>
              ) : null}

              {validation && !validation.valid && validation.errors ? (
                <div className="config-errors config-validation-errors">
                  <strong>Validation errors:</strong>
                  <ul>
                    {validation.errors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="config-editor-panel panel config-shell-panel">
                <YamlEditor value={content} onChange={setContent} />
                <div className="config-footer-hint">
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
