import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import json from 'highlight.js/lib/languages/json'
import python from 'highlight.js/lib/languages/python'
import typescript from 'highlight.js/lib/languages/typescript'
import yaml from 'highlight.js/lib/languages/yaml'
import { Check, Copy, FileCode2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { cn } from '../lib/cn'

hljs.registerLanguage('bash', bash)
hljs.registerLanguage('json', json)
hljs.registerLanguage('jsonc', json)
hljs.registerLanguage('python', python)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('yaml', yaml)

type Props = {
  text: string
  title?: string
  filename?: string
  lang?: string
}

export function CodeBlock({ text, title, filename, lang }: Props) {
  const [copied, setCopied] = useState(false)
  const highlighted = useMemo(() => {
    if (!lang) return null
    try {
      return hljs.highlight(text, { language: lang, ignoreIllegals: true }).value
    } catch {
      return null
    }
  }, [text, lang])

  const copy = () => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      },
      () => {},
    )
  }

  const heading = title ?? filename

  return (
    <section className="group relative overflow-hidden rounded border border-border bg-surface-0">
      {heading ? (
        <div className="flex items-center gap-1.5 border-b border-border bg-surface-3 px-4 py-2 font-mono text-xs text-fg-muted">
          {filename ? <FileCode2 size={13} strokeWidth={2} className="shrink-0 text-fg-dim" /> : null}
          <span>{heading}</span>
          <CopyButton
            className="ml-auto opacity-0 transition-opacity group-hover:opacity-100"
            copied={copied}
            onClick={copy}
          />
        </div>
      ) : null}
      <pre className="m-0 overflow-x-auto bg-surface-2 px-4 py-4 font-mono text-xs leading-relaxed text-fg">
        {highlighted ? (
          <code
            className={`language-${lang}`}
            translate="no"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: highlight.js output from static code templates
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        ) : (
          <code translate="no">{text}</code>
        )}
      </pre>
      {heading ? null : (
        <CopyButton
          className="absolute right-2.5 top-2.5 border bg-surface-3 opacity-0 transition-opacity group-hover:opacity-100"
          copied={copied}
          onClick={copy}
        />
      )}
    </section>
  )
}

function CopyButton({ copied, className, onClick }: { copied: boolean; className?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className={cn(
        'cursor-pointer rounded border-border p-1 text-fg-muted hover:bg-surface-4 hover:text-fg',
        className,
      )}
      onClick={onClick}
      title="Copy to clipboard"
    >
      {copied ? <Check size={13} strokeWidth={2} className="text-ok" /> : <Copy size={13} strokeWidth={2} />}
    </button>
  )
}
