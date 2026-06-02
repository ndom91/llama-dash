import { FileText, Link as LinkIcon, Loader2, Volume2, X } from 'lucide-react'
import { type FormEvent, type KeyboardEvent, useCallback, useState } from 'react'
import { Tooltip } from '../../components/Tooltip'
import { api, type ArticleExtractResponse } from '../../lib/api'
import { cn } from '../../lib/cn'
import { useModels } from '../../lib/queries'
import { usePlaygroundSpeech } from '../../lib/use-playground-speech'
import { PlaygroundSpeechPreviewPlayer } from './PlaygroundSpeechPreviewPlayer'
import { buildSpeechFilename, formatSpeechClock } from './playgroundSpeechUtils'

type SpeechMode = 'text' | 'article'

export function PlaygroundSpeech() {
  const speech = usePlaygroundSpeech()
  const [mode, setMode] = useState<SpeechMode>('text')
  const [articleUrl, setArticleUrl] = useState('')
  const [article, setArticle] = useState<ArticleExtractResponse | null>(null)
  const [articleText, setArticleText] = useState('')
  const [articleLoading, setArticleLoading] = useState(false)
  const [articleError, setArticleError] = useState<string | null>(null)
  const { data: models } = useModels()
  const localModels = models?.filter((m) => m.kind === 'local') ?? []
  const peerModels = models?.filter((m) => m.kind === 'peer') ?? []

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      if (!speech.text.trim()) return
      speech.generate()
      speech.setText('')
    },
    [speech.generate, speech.text, speech.setText],
  )

  const handleExtractArticle = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      const url = articleUrl.trim()
      if (!url || articleLoading) return

      setArticleLoading(true)
      setArticleError(null)
      try {
        const result = await api.extractArticle(url)
        setArticle(result)
        setArticleText(result.text)
      } catch (err) {
        setArticle(null)
        setArticleText('')
        setArticleError(err instanceof Error ? err.message : String(err))
      } finally {
        setArticleLoading(false)
      }
    },
    [articleLoading, articleUrl],
  )

  const handleSpeakArticle = useCallback(() => {
    if (!speech.model || !article || !articleText.trim() || speech.loading) return
    void speech.generate({
      input: articleText,
      source: {
        type: 'article',
        url: article.url,
        finalUrl: article.finalUrl,
        title: article.title,
        siteName: article.siteName,
        wordCount: article.wordCount,
        truncated: article.truncated,
      },
    })
  }, [article, articleText, speech.generate, speech.loading, speech.model])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit(e as unknown as FormEvent)
      }
    },
    [handleSubmit],
  )

  const autoResize = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [])

  const downloadAudio = useCallback((audioUrl: string, input: string, createdAt: number) => {
    const link = document.createElement('a')
    link.href = audioUrl
    link.download = buildSpeechFilename(input, createdAt)
    link.click()
  }, [])

  const renderLabel = (renderMs: number | null) =>
    renderMs != null ? `${(renderMs / 1000).toFixed(1)} s render` : '— render'
  const ratioLabel = (renderMs: number | null, durationSec: number | null) =>
    renderMs != null && durationSec != null && renderMs > 0
      ? `${(durationSec / (renderMs / 1000)).toFixed(1)}× real-time`
      : '— real-time'
  const durationLabel = (durationSec: number | null) =>
    durationSec != null ? formatSpeechClock(durationSec) : '--:--.-'

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border bg-surface-1/70 px-6 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex min-w-[220px] items-center gap-3 border-r border-border pr-4">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-fg-faint">model</div>
            <select
              id="pg-speech-model"
              className="select-native min-w-0 border-0 bg-transparent py-0 font-mono text-xs text-fg outline-none"
              value={speech.model}
              onChange={(e) => speech.setModel(e.target.value)}
            >
              <option value="">select…</option>
              {localModels.length > 0 ? (
                <optgroup label="Local">
                  {localModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id}
                      {m.running ? ' ●' : ''}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {peerModels.length > 0 ? (
                <optgroup label="Peers">
                  {peerModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </div>

          <div className="flex min-w-[180px] items-center gap-3 border-r border-border pr-4">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-fg-faint">voice</div>
            {speech.voices ? (
              <select
                id="pg-speech-voice"
                className="select-native min-w-0 border-0 bg-transparent py-0 font-mono text-xs text-fg outline-none"
                value={speech.voice}
                onChange={(e) => speech.setVoice(e.target.value)}
              >
                <option value="">default</option>
                {speech.voices.map((voice) => (
                  <option key={voice} value={voice}>
                    {voice}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="pg-speech-voice"
                type="text"
                className="min-w-0 border-0 bg-transparent font-mono text-xs text-fg outline-none"
                placeholder="voice name…"
                value={speech.voice}
                onChange={(e) => speech.setVoice(e.target.value)}
              />
            )}
          </div>

          <div className="ml-auto flex items-center gap-3 text-[10px] font-mono uppercase tracking-[0.08em] text-fg-dim">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-fg-faint">
              input
            </div>
            <div
              className="flex overflow-hidden rounded border border-border bg-surface-2 p-0.5"
              role="group"
              aria-label="Speech input mode"
            >
              {(['text', 'article'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={cn(
                    'rounded-sm px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] transition-[background-color,color] duration-100',
                    mode === item ? 'bg-accent text-accent-on' : 'text-fg-dim hover:bg-surface-1 hover:text-fg',
                  )}
                  aria-pressed={mode === item}
                  onClick={() => setMode(item)}
                >
                  {item === 'text' ? 'text' : 'article'}
                </button>
              ))}
            </div>
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-fg-faint">format</div>
            <div className="text-xs normal-case tracking-normal text-fg">mp3 • 24 kHz</div>
          </div>
        </div>
      </div>

      <section className="panel !rounded-none !border-t-0 !bg-transparent flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto bg-surface-0 px-6 pt-5 pb-4">
          {speech.error ? (
            <div className="rounded border border-err bg-err-bg px-3.5 py-2.5 font-mono text-xs text-err">
              {speech.error}
            </div>
          ) : null}

          {mode === 'article' ? (
            <div className="mx-auto flex w-full max-w-[920px] flex-col gap-3 rounded border border-border bg-surface-2 p-4">
              <form className="flex flex-col gap-3" onSubmit={handleExtractArticle}>
                <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-fg-faint">
                  <LinkIcon className="size-3.5" aria-hidden="true" />
                  <label htmlFor="pg-speech-article-url">article url</label>
                </div>
                <div className="flex flex-col gap-2 md:flex-row">
                  <input
                    id="pg-speech-article-url"
                    type="url"
                    className="min-w-0 flex-1 rounded border border-border bg-surface-1 px-3 py-2 font-mono text-xs text-fg transition-[border-color,box-shadow] duration-100 ease-out focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="https://example.com/article"
                    value={articleUrl}
                    onChange={(e) => setArticleUrl(e.target.value)}
                    disabled={articleLoading || speech.loading}
                    aria-describedby="pg-speech-article-help"
                  />
                  <button
                    type="submit"
                    className="btn btn-secondary btn-md"
                    disabled={!articleUrl.trim() || articleLoading || speech.loading}
                  >
                    {articleLoading ? (
                      <Loader2 className="size-3.5 shrink-0 animate-spin" strokeWidth={2} aria-hidden="true" />
                    ) : (
                      <FileText className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                    )}
                    <span>extract</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-md"
                    disabled={!speech.model || !article || !articleText.trim() || speech.loading || articleLoading}
                    onClick={handleSpeakArticle}
                  >
                    {speech.loading ? (
                      <Loader2 className="size-3.5 shrink-0 animate-spin" strokeWidth={2} aria-hidden="true" />
                    ) : (
                      <Volume2 className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                    )}
                    <span>speak article</span>
                  </button>
                </div>
                <p id="pg-speech-article-help" className="text-[12px] leading-5 text-fg-dim">
                  Fetches the page server-side, extracts the readable article body, then lets you edit the text before
                  generating speech.
                </p>
              </form>

              {articleError ? (
                <div className="rounded border border-err bg-err-bg px-3.5 py-2.5 font-mono text-xs text-err">
                  {articleError}
                </div>
              ) : null}

              {article ? (
                <div className="flex flex-col gap-3 rounded border border-border bg-surface-1 p-3">
                  <div className="flex flex-col gap-1">
                    <div className="text-sm font-semibold text-fg">{article.title ?? 'Untitled article'}</div>
                    <div className="font-mono text-[11px] text-fg-dim">
                      {[article.siteName ?? getUrlHost(article.finalUrl), article.byline, `${article.wordCount} words`]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                    {article.truncated ? (
                      <div className="rounded border border-warn bg-warn-bg px-2.5 py-1.5 font-mono text-[11px] text-warn">
                        Extracted text was trimmed to {article.text.length.toLocaleString()} characters for this first
                        pass.
                      </div>
                    ) : null}
                  </div>
                  <label
                    htmlFor="pg-speech-article-text"
                    className="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-fg-faint"
                  >
                    extracted text
                  </label>
                  <textarea
                    id="pg-speech-article-text"
                    className="min-h-48 resize-y rounded border border-border bg-surface-0 px-3 py-2 text-[13px] leading-6 text-fg transition-[border-color,box-shadow] duration-100 ease-out focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    value={articleText}
                    onChange={(e) => setArticleText(e.target.value)}
                    disabled={speech.loading}
                    spellCheck={false}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {speech.entries.length > 0 ? (
            <div className="mx-auto flex w-full max-w-[920px] flex-col gap-4">
              {speech.entries.map((entry) => {
                const articleSource = entry.source?.type === 'article' ? entry.source : null
                return (
                  <div key={entry.id} className="flex flex-col gap-3 rounded border border-border bg-surface-2 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-fg-faint">
                        {articleSource ? 'article preview' : 'preview'}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="text-right font-mono text-[11px] leading-none text-fg-dim">
                          <span>{entry.voice}</span> ·<span>{durationLabel(entry.audioDurationSec)}</span> ·
                          <span>{renderLabel(entry.renderMs)}</span> ·
                          <span>{ratioLabel(entry.renderMs, entry.audioDurationSec)}</span>
                        </div>
                        <Tooltip label="Close">
                          <button
                            type="button"
                            className="flex h-4 w-4 items-center justify-center rounded-sm bg-transparent text-fg-dim transition-[background-color,color,transform] duration-100 hover:bg-surface-1 hover:text-fg active:scale-90"
                            onClick={() => speech.removeEntry(entry.id)}
                            aria-label="Remove speech result"
                          >
                            <X className="size-3 shrink-0" strokeWidth={2} />
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                    {articleSource ? (
                      <div className="flex flex-wrap items-center gap-2 rounded border border-border bg-surface-1 px-2.5 py-2 font-mono text-[11px] text-fg-dim">
                        <FileText className="size-3.5 text-fg-faint" strokeWidth={2} aria-hidden="true" />
                        <span className="text-fg">{articleSource.title ?? getUrlHost(articleSource.finalUrl)}</span>
                        <span>·</span>
                        <span>{articleSource.siteName ?? getUrlHost(articleSource.finalUrl)}</span>
                        <span>·</span>
                        <span>{articleSource.wordCount} words</span>
                        {articleSource.truncated ? <span>· trimmed</span> : null}
                      </div>
                    ) : null}
                    <div className="text-[13px] leading-[1.6] text-fg">
                      {previewSpeechInput(entry.input, !!articleSource)}
                    </div>
                    <PlaygroundSpeechPreviewPlayer
                      key={entry.audioUrl}
                      src={entry.audioUrl}
                      durationHint={entry.audioDurationSec}
                      onDownload={() => downloadAudio(entry.audioUrl, entry.input, entry.createdAt ?? Date.now())}
                    />
                  </div>
                )
              })}
            </div>
          ) : !speech.loading && !speech.error && mode === 'text' ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-[13px] text-fg-faint">
              <Volume2 className="h-10 w-10 opacity-30" strokeWidth={1.25} />
              <span>Convert text to speech</span>
            </div>
          ) : null}
        </div>

        {mode === 'text' ? (
          <form className="flex items-end gap-2 border-t border-border px-4 py-3" onSubmit={handleSubmit}>
            <label htmlFor="pg-speech-text" className="sr-only">
              Text to speak
            </label>
            <textarea
              id="pg-speech-text"
              className="max-h-[200px] flex-1 resize-none overflow-hidden rounded border border-border bg-surface-1 px-3 py-2 text-[13px] leading-6 text-fg transition-[border-color,box-shadow] duration-100 ease-out focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              placeholder={speech.model ? 'Enter text to speak…' : 'Select a model first…'}
              value={speech.text}
              onChange={(e) => speech.setText(e.target.value)}
              disabled={!speech.model}
              rows={1}
              onKeyDown={handleKeyDown}
              onInput={(e) => autoResize(e.currentTarget)}
              spellCheck={false}
            />
            <Tooltip label="Generate speech">
              <button
                type="submit"
                className="btn btn-primary btn-md"
                disabled={!speech.model || !speech.text.trim() || speech.loading}
              >
                {speech.loading ? (
                  <Loader2 className="size-3.5 shrink-0 animate-spin" strokeWidth={2} aria-hidden="true" />
                ) : (
                  <Volume2 className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                )}
                <span>speak</span>
              </button>
            </Tooltip>
          </form>
        ) : null}
      </section>
    </div>
  )
}

function getUrlHost(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, '')
  } catch {
    return 'article'
  }
}

function previewSpeechInput(input: string, compact: boolean) {
  if (!compact || input.length <= 500) return input
  return `${input.slice(0, 500).trimEnd()}…`
}
