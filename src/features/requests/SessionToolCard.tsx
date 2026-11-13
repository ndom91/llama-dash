// Captured command and output positions are stable and may contain duplicate text.
// biome-ignore-all lint/suspicious/noArrayIndexKey: Positions distinguish repeated captured lines.
import { useMemo, useState } from 'react'
import { formatDuration } from '../../lib/format'
import type { TranscriptPart } from './sessionTranscript'
import { summarizeTool } from './sessionToolSummary'
import { SessionEntry } from './SessionEntry'

export function SessionToolCard({
  part,
  result,
  resultNumber,
  elapsed,
  expanded,
  incomplete,
}: {
  part: TranscriptPart
  result?: TranscriptPart
  resultNumber?: number
  elapsed?: number
  expanded: boolean
  incomplete: boolean
}) {
  const [full, setFull] = useState(expanded)
  const [raw, setRaw] = useState(false)
  const info = useMemo(() => summarizeTool(part.name ?? 'tool', part.text, result), [part, result])
  const lines = (raw ? (result?.text ?? '') : info.output).split('\n')
  const status = !result
    ? incomplete
      ? 'result may be in unloaded requests'
      : 'no result captured'
    : info.status === 'error'
      ? 'error'
      : info.status === null
        ? 'result captured'
        : `exit ${info.status}`
  return (
    <SessionEntry
      kind="tool"
      initiallyOpen={expanded}
      summary={
        <>
          <span className="text-[var(--accent-shifted)]">{info.name}</span> · {info.summary}
          {info.commands.length > 1 ? ` · +${info.commands.length - 1} more` : ''}
        </>
      }
      meta={
        <>
          <span
            className={!result || info.status === null ? 'text-fg-dim' : info.status === 0 ? 'text-ok' : 'text-err'}
          >
            {status}
          </span>
          {elapsed != null ? ` · ${formatDuration(elapsed)}` : ''}
          {result ? ` · ${info.size} ${info.size === 1 ? 'line' : 'lines'}` : ''}
        </>
      }
    >
      {info.commands.length ? (
        <div className="space-y-1 py-1">
          {info.commands.map((command, index) => (
            <div key={index} className="flex gap-3">
              <span className="min-w-0 flex-1 break-all">
                <span className="text-fg-dim">$ </span>
                {command.command}
                {command.workdir ? <span className="text-fg-dim"> · {command.workdir}</span> : null}
              </span>
              {command.exitCode != null ? (
                <span className={command.exitCode === 0 ? 'text-ok' : 'text-err'}>
                  {command.exitCode === 0 ? '✓' : '✗'} {command.exitCode}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : result && part.text ? (
        <pre className="m-0 overflow-x-auto whitespace-pre-wrap break-words px-3 py-2 text-fg-dim">{part.text}</pre>
      ) : null}
      {result ? (
        <div className="py-2">
          <div className="mb-2 flex flex-wrap items-center gap-3 text-fg-dim">
            <span className="mr-auto uppercase">output · returned in #{resultNumber}</span>
            <button type="button" className="text-info" onClick={() => setFull(!full)}>
              {full ? 'collapse' : 'expand'}
            </button>
            <button type="button" className="text-info" aria-pressed={raw} onClick={() => setRaw(!raw)}>
              {raw ? 'output' : 'raw json'}
            </button>
          </div>
          <pre className="m-0 overflow-x-auto whitespace-pre text-fg-dim">
            {(full ? lines : lines.slice(0, 3)).map((line, index) => (
              <span key={index} className={`block ${index === 0 ? 'text-fg' : ''}`}>
                {line || ' '}
              </span>
            ))}
          </pre>
        </div>
      ) : (
        <pre className="m-0 overflow-x-auto whitespace-pre-wrap break-words px-3 py-2 text-fg-dim">{part.text}</pre>
      )}
    </SessionEntry>
  )
}
