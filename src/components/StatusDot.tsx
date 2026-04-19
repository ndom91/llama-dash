import { cn } from '../lib/cn'

type Tone = 'ok' | 'warn' | 'err' | 'idle'

const toneStyles: Record<Tone, string> = {
  ok: 'bg-ok shadow-[0_0_6px_var(--ok)]',
  warn: 'bg-warn shadow-[0_0_6px_var(--warn)]',
  err: 'bg-err shadow-[0_0_6px_var(--err)]',
  idle: 'bg-transparent border border-fg-faint shadow-none',
}

export function StatusDot({ tone, live = false }: { tone: Tone; live?: boolean }) {
  return (
    <span
      className={cn(
        'size-2 rounded-pill shrink-0 inline-block transition-[background-color,box-shadow] duration-[180ms]',
        toneStyles[tone],
        live && tone === 'ok' && 'animate-pulse-ok',
        live && tone === 'warn' && 'animate-pulse-warn',
      )}
      aria-hidden="true"
    />
  )
}

export function stateTone(state: string, running: boolean): Tone {
  if (!running) return 'idle'
  switch (state) {
    case 'ready':
      return 'ok'
    case 'starting':
    case 'stopping':
      return 'warn'
    case 'stopped':
    case 'shutdown':
      return 'idle'
    default:
      return 'warn'
  }
}
