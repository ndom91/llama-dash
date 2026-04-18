type Props = { size?: number; withWordmark?: boolean; className?: string }

export function Logo({ size = 20, withWordmark = false, className }: Props) {
  return (
    <span
      className={className}
      role="img"
      aria-label="llama-dash"
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
          llama-dash
        </span>
      )}
    </span>
  )
}
