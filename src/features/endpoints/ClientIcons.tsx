import type { ReactNode, SVGProps } from 'react'

// Hand-drawn stand-ins for brand marks, on lucide's grid: 24x24, 2px stroke,
// round caps and joins, so they sit next to lucide icons without clashing.
// Decorative only (always beside a text label), so hidden from assistive tech.
type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'>

function StrokeIcon({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

/** Claude's spark: uneven rays from a shared centre. */
export function ClaudeCodeIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M12 12V2.5M12 12l5-5.6M12 12l9-.3M12 12l5.1 4.8M12 12v9.5M12 12l-5 5.6M12 12l-8.5.3M12 12 7 7.1" />
    </StrokeIcon>
  )
}

/** opencode's block mark: a frame with an inset lower panel. */
export function OpencodeIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <rect x="8" y="11" width="8" height="6" rx="0.5" />
    </StrokeIcon>
  )
}

/** Home Assistant's house with the three-node circuit tree inside. */
export function HomeAssistantIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M12 21v-10M12 17.5l-3.75-3.34M12 15l3.75-3.34" />
      <circle cx="12" cy="10" r="1" />
      <circle cx="7.5" cy="13.5" r="1" />
      <circle cx="16.5" cy="11" r="1" />
    </StrokeIcon>
  )
}
