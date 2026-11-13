import { memo, useState } from 'react'
import Markdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import { CopyButton } from '../../components/CopyButton'
import { SessionMessageClamp } from './SessionMessageClamp'

// CommonMark closes an unfinished list at the end of the document. Close fences
// explicitly as well, so the truncation marker is never included in a code block.
export function closeTruncatedMarkdown(text: string): string {
  let fence: { char: string; length: number } | undefined
  for (const line of text.split('\n')) {
    const match = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/)
    if (!match) continue
    if (!fence) fence = { char: match[1][0], length: match[1].length }
    else if (match[1][0] === fence.char && match[1].length >= fence.length && !match[2].trim()) fence = undefined
  }
  return fence ? `${text}\n${fence.char.repeat(fence.length)}` : text
}

type CodeNode = { type: string; value?: string; children?: CodeNode[]; properties?: { className?: string[] } }
function nodeText(node: CodeNode): string {
  return node.type === 'text' ? (node.value ?? '') : (node.children ?? []).map(nodeText).join('')
}

export const SessionAssistantMessage = memo(function SessionAssistantMessage({
  text,
  time,
  truncated,
  hideRaw = false,
}: {
  text: string
  time: string
  truncated: boolean
  hideRaw?: boolean
}) {
  const [raw, setRaw] = useState(false)
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
        <span className="size-1.5 rounded-full bg-ok" />
        assistant
        <time title="Request start time">{new Date(time).toLocaleTimeString()}</time>
        <div className="ml-auto flex items-center gap-1 normal-case tracking-normal">
          {!hideRaw ? (
            <button type="button" aria-pressed={raw} onClick={() => setRaw(!raw)} className="px-1.5 py-1 hover:text-fg">
              {raw ? 'markdown' : 'raw'}
            </button>
          ) : null}
          <CopyButton text={text} variant="icon" ariaLabel="Copy assistant message" />
        </div>
      </div>
      <div className="ml-0.5 min-w-0 border-l border-border-strong pl-5">
        <SessionMessageClamp text={text}>
          <div className="session-md">
            {raw ? (
              <pre className="session-message-source">{text}</pre>
            ) : (
              <Markdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                  pre({ node, children }) {
                    const code = node?.children[0] as CodeNode | undefined
                    const language = code?.properties?.className?.find((name) => name.startsWith('language-'))?.slice(9)
                    const source = code ? nodeText(code).replace(/\n$/, '') : ''
                    return (
                      <div className="session-code-block">
                        <div className="session-code-header">
                          <span>{language || 'code'}</span>
                          <CopyButton text={source} ariaLabel="Copy code block" />
                        </div>
                        {/* biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to scroll long code lines. */}
                        <pre tabIndex={0}>{children}</pre>
                      </div>
                    )
                  },
                  table({ children }) {
                    return (
                      // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to scroll wide tables.
                      <section className="session-table-scroll" tabIndex={0} aria-label="Message table">
                        <table>{children}</table>
                      </section>
                    )
                  },
                }}
              >
                {truncated ? closeTruncatedMarkdown(text) : text}
              </Markdown>
            )}
            {truncated ? (
              <span className="text-fg-dim">
                {' '}
                …<span className="sr-only">Response truncated</span>
              </span>
            ) : null}
          </div>
        </SessionMessageClamp>
      </div>
    </div>
  )
})
