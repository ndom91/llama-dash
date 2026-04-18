import { createFileRoute } from '@tanstack/react-router'
import { AlertTriangle, AlignLeft, Check, Loader2, RefreshCw, Save } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { TopBar } from '../components/TopBar'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { api, type ApiConfigSaveResult } from '../lib/api'

export const Route = createFileRoute('/config')({ component: ConfigPage })

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'unavailable' }
  | { status: 'ready'; original: string; modifiedAt: number }

function ConfigPage() {
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
      if (msg.includes('404')) {
        setLoadState({ status: 'unavailable' })
      } else {
        setLoadState({ status: 'error', message: msg })
      }
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
      setLoadState({ status: 'ready', original: content, modifiedAt: Date.now() })
      setValidation(null)
    }
  }, [content, loadState, saving])

  const doFormat = useCallback(() => {
    try {
      const parsed = parseYaml(content)
      const formatted = stringifyYaml(parsed, { indent: 2, lineWidth: 0 })
      setContent(formatted)
    } catch {
      // invalid YAML — don't format
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
        <div className="page">
          <PageHeader
            kicker="§06 · settings"
            title="Configuration"
            subtitle="llama-swap config.yaml"
            action={
              loadState.status === 'ready' ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
            <div className="empty-state">loading config…</div>
          ) : loadState.status === 'unavailable' ? (
            <div className="empty-state">
              <code>LLAMASWAP_CONFIG_FILE</code> is not set. Set it to the path of your llama-swap config.yaml to enable
              editing.
            </div>
          ) : loadState.status === 'error' ? (
            <div className="err-banner">{loadState.message}</div>
          ) : (
            <>
              {saveResult && 'conflict' in saveResult && saveResult.conflict ? (
                <div className="err-banner" style={{ marginBottom: 12 }}>
                  <AlertTriangle size={14} strokeWidth={2} /> Config was modified externally. Reload to get latest
                  version.
                  <button type="button" className="btn btn-ghost btn-xs" style={{ marginLeft: 8 }} onClick={load}>
                    Reload
                  </button>
                </div>
              ) : null}

              {validation && !validation.valid && validation.errors ? (
                <div className="config-errors">
                  <strong>Validation errors:</strong>
                  <ul>
                    {validation.errors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="config-editor-panel panel">
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

function YamlEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const preRef = useRef<HTMLPreElement>(null)

  const lineCount = useMemo(() => value.split('\n').length, [value])
  const highlighted = useMemo(() => highlightYaml(value), [value])

  const syncScroll = () => {
    const ta = textareaRef.current
    const pre = preRef.current
    if (ta && pre) {
      pre.scrollTop = ta.scrollTop
      pre.scrollLeft = ta.scrollLeft
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = e.currentTarget
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const before = value.slice(0, start)
      const after = value.slice(end)
      const next = `${before}  ${after}`
      onChange(next)
      requestAnimationFrame(() => {
        ta.selectionStart = start + 2
        ta.selectionEnd = start + 2
      })
    }
  }

  return (
    <div className="config-editor-wrap">
      <div className="config-line-numbers" aria-hidden="true">
        {Array.from({ length: lineCount }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: line numbers are sequential and never reorder
          <span key={i}>{i + 1}</span>
        ))}
      </div>
      <div className="config-editor-inner">
        <pre ref={preRef} className="config-highlight" aria-hidden="true">
          {highlightedToJsx(highlighted)}
        </pre>
        <textarea
          ref={textareaRef}
          className="config-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={syncScroll}
          onKeyDown={onKeyDown}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
      </div>
    </div>
  )
}

type Token = { cls: string; text: string; offset: number } | string

function highlightYaml(yaml: string): Array<Token> {
  const YAML_RE =
    /^(#.*)$|(^[ \t]*[\w./-]+)(?=\s*:)|(?<=:\s*)("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(:\s)|(true|false|null|~)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b|(^\s*-\s)/gm
  const out: Array<Token> = []
  let i = 0
  YAML_RE.lastIndex = 0
  for (let m = YAML_RE.exec(yaml); m !== null; m = YAML_RE.exec(yaml)) {
    if (m.index > i) out.push(yaml.slice(i, m.index))
    i = m.index + m[0].length
    const [, comment, key, str, colon, bool, num, dash] = m
    if (comment) out.push({ cls: 'yh-comment', text: comment, offset: m.index })
    else if (key) out.push({ cls: 'yh-key', text: key, offset: m.index })
    else if (str) out.push({ cls: 'yh-str', text: str, offset: m.index })
    else if (colon) out.push({ cls: 'yh-punct', text: colon, offset: m.index })
    else if (bool) out.push({ cls: 'yh-bool', text: bool, offset: m.index })
    else if (num) out.push({ cls: 'yh-num', text: num, offset: m.index })
    else if (dash) out.push({ cls: 'yh-punct', text: dash, offset: m.index })
    else out.push(m[0])
  }
  if (i < yaml.length) out.push(yaml.slice(i))
  return out
}

function highlightedToJsx(tokens: Array<Token>): Array<React.ReactElement | string> {
  return tokens.map((t) =>
    typeof t === 'string' ? (
      t
    ) : (
      <span key={t.offset} className={t.cls}>
        {t.text}
      </span>
    ),
  )
}
