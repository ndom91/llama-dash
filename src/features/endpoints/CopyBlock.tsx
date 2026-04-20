import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import json from 'highlight.js/lib/languages/json'
import python from 'highlight.js/lib/languages/python'
import typescript from 'highlight.js/lib/languages/typescript'
import yaml from 'highlight.js/lib/languages/yaml'
import { FileCode2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CopyIcon } from './CopyIcon'

hljs.registerLanguage('bash', bash)
hljs.registerLanguage('python', python)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('yaml', yaml)

type Props = {
  text: string
  inline?: boolean
  filename?: string
  lang?: string
}

export function CopyBlock({ text, inline, filename, lang }: Props) {
  const [copied, setCopied] = useState(false)
  const highlighted = useMemo(() => {
    if (!lang || inline) return null
    try {
      return hljs.highlight(text, { language: lang }).value
    } catch {
      return null
    }
  }, [text, lang, inline])

  const copy = () => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      },
      () => {},
    )
  }

  if (inline) {
    return (
      <button
        type="button"
        className="group inline-flex items-center gap-2 px-3 py-1.5 rounded bg-surface-3 border border-border font-mono text-sm text-fg cursor-pointer transition-colors hover:bg-surface-4 hover:border-border-strong"
        onClick={copy}
      >
        <code className="[font:inherit]" translate="no">
          {text}
        </code>
        <CopyIcon copied={copied} />
      </button>
    )
  }

  return (
    <div className="relative group rounded border border-border overflow-hidden">
      {filename ? (
        <div className="flex items-center gap-1.5 px-4 py-2 bg-surface-3 border-b border-border">
          <FileCode2 size={13} strokeWidth={2} className="text-fg-dim shrink-0" />
          <span className="font-mono text-xs text-fg-muted">{filename}</span>
          <button
            type="button"
            className="ml-auto p-1 rounded cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity hover:bg-surface-4"
            onClick={copy}
            title="Copy to clipboard"
          >
            <CopyIcon copied={copied} />
          </button>
        </div>
      ) : null}
      <pre className="bg-surface-2 p-4 font-mono text-xs text-fg overflow-x-auto m-0 leading-relaxed">
        {highlighted ? (
          <code
            className={`language-${lang}`}
            translate="no"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: highlight.js output from our own templates
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        ) : (
          <code translate="no">{text}</code>
        )}
      </pre>
      {!filename ? (
        <button
          type="button"
          className="absolute top-2.5 right-2.5 p-1.5 rounded bg-surface-3 border border-border cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity hover:bg-surface-4"
          onClick={copy}
          title="Copy to clipboard"
        >
          <CopyIcon copied={copied} />
        </button>
      ) : null}
    </div>
  )
}
