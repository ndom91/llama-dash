import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import json from 'highlight.js/lib/languages/json'
import python from 'highlight.js/lib/languages/python'
import typescript from 'highlight.js/lib/languages/typescript'
import yaml from 'highlight.js/lib/languages/yaml'
import { Check, Copy, FileCode2 } from 'lucide-react'
import { type ReactNode, useMemo } from 'react'
import { cn } from '../lib/cn'
import { useCopyToClipboard } from '../lib/use-copy-to-clipboard'
import { Tooltip } from './Tooltip'

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
  /**
   * Right-aligned header content. Switches the header to a filename tab plus
   * an always-visible, labelled copy button.
   */
  meta?: ReactNode
  className?: string
}

export function CodeBlock({ text, title, filename, lang, meta, className }: Props) {
  const { copied, copy: copyText } = useCopyToClipboard(1500)
  const highlighted = useMemo(() => {
    if (!lang) return null
    try {
      return hljs.highlight(text, { language: lang, ignoreIllegals: true }).value
    } catch {
      return null
    }
  }, [text, lang])

  const copy = () => {
    void copyText(text)
  }

  const heading = title ?? filename

  return (
    <section className={cn('group relative overflow-hidden rounded border border-border bg-surface-0', className)}>
      {meta ? (
        <div className="flex items-stretch border-b border-border bg-surface-3 font-mono text-xs text-fg-muted">
          <span className="-mb-px flex items-center gap-1.5 border-r border-border bg-surface-2 px-4 py-2 text-fg">
            {filename ? <FileCode2 size={13} strokeWidth={2} className="shrink-0 text-fg-dim" /> : null}
            {heading}
          </span>
          <div className="ml-auto flex min-w-0 items-center gap-2.5 px-3">
            {meta}
            <CodeBlockCopyButton copied={copied} onClick={copy} labelled />
          </div>
        </div>
      ) : heading ? (
        <div className="flex items-center gap-1.5 border-b border-border bg-surface-3 px-4 py-2 font-mono text-xs text-fg-muted">
          {filename ? <FileCode2 size={13} strokeWidth={2} className="shrink-0 text-fg-dim" /> : null}
          <span>{heading}</span>
          <CodeBlockCopyButton
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
        <CodeBlockCopyButton
          className="absolute right-2.5 top-2.5 border bg-surface-3 opacity-0 transition-opacity group-hover:opacity-100"
          copied={copied}
          onClick={copy}
        />
      )}
    </section>
  )
}

function CodeBlockCopyButton({
  copied,
  className,
  labelled = false,
  onClick,
}: {
  copied: boolean
  className?: string
  labelled?: boolean
  onClick: () => void
}) {
  return (
    <Tooltip label={copied ? 'Copied' : 'Copy to clipboard'} side="left">
      <button
        type="button"
        className={cn(
          'inline-flex cursor-pointer items-center gap-1 rounded border-border p-1 text-fg-muted transition-[background-color,color,transform,opacity] duration-120 active:scale-[0.97] hover:bg-surface-4 hover:text-fg focus-visible:outline-none focus-visible:shadow-focus',
          className,
        )}
        onClick={onClick}
      >
        {copied ? <Check size={13} strokeWidth={2} className="text-ok" /> : <Copy size={13} strokeWidth={2} />}
        {labelled ? <span>{copied ? 'copied' : 'copy'}</span> : null}
      </button>
    </Tooltip>
  )
}
