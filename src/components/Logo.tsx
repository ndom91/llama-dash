type Props = { size?: number; withWordmark?: boolean; decorative?: boolean; className?: string }

export function Logo({ size = 20, withWordmark = false, decorative = false, className }: Props) {
  const accessibilityProps = decorative
    ? { 'aria-hidden': true }
    : { role: 'img' as const, 'aria-label': 'llswap-dash' }

  return (
    <span
      className={className}
      {...accessibilityProps}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size * 0.5,
        fontSize: size,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'flex-end',
          gap: '0.25em',
          lineHeight: 0.8,
        }}
      >
        <span
          style={{
            fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
            fontWeight: 700,
            letterSpacing: '-0.04em',
            color: 'currentColor',
          }}
        >
          ld
        </span>
        <span
          aria-hidden
          style={{
            width: '0.5em',
            height: '0.115em',
            background: 'var(--ld-phosphor-500, #9DC98A)',
            marginBottom: '0.08em',
          }}
        />
      </span>
      {withWordmark && (
        <span
          style={{
            fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
            fontWeight: 500,
            fontSize: '0.75em',
            letterSpacing: '-0.005em',
            color: 'currentColor',
          }}
        >
          llswap-dash
        </span>
      )}
    </span>
  )
}
