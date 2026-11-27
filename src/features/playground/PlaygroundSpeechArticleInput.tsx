import { FileText, Link as LinkIcon, Loader2, Volume2 } from 'lucide-react'
import type { FormEvent } from 'react'
import type { ArticleExtractResponse } from '../../lib/api'
import { getUrlHost } from './playgroundSpeechUtils'

type Props = {
  url: string
  onUrlChange: (value: string) => void
  onExtract: (e: FormEvent) => void
  extracting: boolean
  error: string | null
  article: ArticleExtractResponse | null
  text: string
  onTextChange: (value: string) => void
  onSpeak: () => void
  canSpeak: boolean
  speaking: boolean
}

/** Article-mode input row, rendered as an extension of the speech toolbar. */
export function PlaygroundSpeechArticleInput({
  url,
  onUrlChange,
  onExtract,
  extracting,
  error,
  article,
  text,
  onTextChange,
  onSpeak,
  canSpeak,
  speaking,
}: Props) {
  const busy = extracting || speaking
  const help = article
    ? 'Review or edit the extracted text, then read it aloud in chunked segments.'
    : 'Fetches the page server-side and extracts the readable article body for review before speech generation.'

  return (
    <div className="flex flex-col gap-3 border-t border-border px-6 py-3">
      <form className="flex flex-wrap items-center gap-3" onSubmit={onExtract}>
        <label
          htmlFor="pg-speech-article-url"
          className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-fg-faint"
        >
          <LinkIcon className="size-3" aria-hidden="true" />
          article url
        </label>
        <input
          id="pg-speech-article-url"
          type="url"
          className="min-w-[240px] flex-1 rounded border border-border bg-surface-0 px-3 py-1.5 font-mono text-xs text-fg transition-[border-color,box-shadow] duration-100 ease-out focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="https://example.com/article"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          disabled={busy}
          aria-describedby="pg-speech-article-help"
        />
        <div className="flex items-center gap-2">
          <button type="submit" className="btn btn-secondary" disabled={!url.trim() || busy}>
            {extracting ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin" strokeWidth={2} aria-hidden="true" />
            ) : (
              <FileText className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
            )}
            <span>Extract text</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canSpeak || busy}
            onClick={onSpeak}
            aria-describedby="pg-speech-article-help"
          >
            {speaking ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin" strokeWidth={2} aria-hidden="true" />
            ) : (
              <Volume2 className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
            )}
            <span>Read aloud</span>
          </button>
        </div>
      </form>

      <p id="pg-speech-article-help" className="-mt-1 text-[11px] leading-4 text-fg-dim">
        {help}
      </p>

      {error ? (
        <div className="rounded border border-err bg-err-bg px-3 py-2 font-mono text-xs text-err">{error}</div>
      ) : null}

      {article ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <label
              htmlFor="pg-speech-article-text"
              className="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-fg-faint"
            >
              extracted text
            </label>
            <span className="min-w-0 truncate text-xs font-semibold text-fg">
              {article.title ?? 'Untitled article'}
            </span>
            <span className="font-mono text-[11px] text-fg-dim">
              {[article.siteName ?? getUrlHost(article.finalUrl), article.byline, `${article.wordCount} words`]
                .filter(Boolean)
                .join(' · ')}
            </span>
            {article.truncated ? (
              <span className="rounded-sm border border-warn bg-warn-bg px-1.5 py-0.5 font-mono text-[10px] text-warn">
                trimmed to {article.text.length.toLocaleString()} chars
              </span>
            ) : null}
          </div>
          <textarea
            id="pg-speech-article-text"
            className="h-40 max-h-[45vh] min-h-24 resize-y rounded border border-border bg-surface-0 px-3 py-2 text-[13px] leading-6 text-fg transition-[border-color,box-shadow] duration-100 ease-out focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            disabled={speaking}
            spellCheck={false}
          />
        </div>
      ) : null}
    </div>
  )
}
