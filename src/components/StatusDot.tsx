type Tone = 'ok' | 'warn' | 'err' | 'idle'

/**
 * Terminal-inspired status indicator. `live` toggles the pulsing glow for
 * transitional states (starting, stopping) or ongoing activity.
 */
export function StatusDot({ tone, live = false }: { tone: Tone; live?: boolean }) {
  const classes = ['dot', `dot-${tone}`, live && (tone === 'ok' || tone === 'warn') ? 'is-live' : '']
    .filter(Boolean)
    .join(' ')
  return <span className={classes} aria-hidden />
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
