import type { ReactNode, SVGProps } from 'react'

// Brand marks for the client chips, coloured with currentColor so they follow
// the chip's text colour. Decorative only (always beside a text label), so
// hidden from assistive tech.
type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'>

function BrandSvg({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...props}>
      {children}
    </svg>
  )
}

/** Claude's spark, from claude.ai. */
export function ClaudeCodeIcon(props: IconProps) {
  return (
    <BrandSvg viewBox="0 0 100 100" fill="currentColor" {...props}>
      <path d="m19.6 66.5 19.7-11 .3-1-.3-.5h-1l-3.3-.2-11.2-.3L14 53l-9.5-.5-2.4-.5L0 49l.2-1.5 2-1.3 2.9.2 6.3.5 9.5.6 6.9.4L38 49.1h1.6l.2-.7-.5-.4-.4-.4L29 41l-10.6-7-5.6-4.1-3-2-1.5-2-.6-4.2 2.7-3 3.7.3.9.2 3.7 2.9 8 6.1L37 36l1.5 1.2.6-.4.1-.3-.7-1.1L33 25l-6-10.4-2.7-4.3-.7-2.6c-.3-1-.4-2-.4-3l3-4.2L28 0l4.2.6L33.8 2l2.6 6 4.1 9.3L47 29.9l2 3.8 1 3.4.3 1h.7v-.5l.5-7.2 1-8.7 1-11.2.3-3.2 1.6-3.8 3-2L61 2.6l2 2.9-.3 1.8-1.1 7.7L59 27.1l-1.5 8.2h.9l1-1.1 4.1-5.4 6.9-8.6 3-3.5L77 13l2.3-1.8h4.3l3.1 4.7-1.4 4.9-4.4 5.6-3.7 4.7-5.3 7.1-3.2 5.7.3.4h.7l12-2.6 6.4-1.1 7.6-1.3 3.5 1.6.4 1.6-1.4 3.4-8.2 2-9.6 2-14.3 3.3-.2.1.2.3 6.4.6 2.8.2h6.8l12.6 1 3.3 2 1.9 2.7-.3 2-5.1 2.6-6.8-1.6-16-3.8-5.4-1.3h-.8v.4l4.6 4.5 8.3 7.5L89 80.1l.5 2.4-1.3 2-1.4-.2-9.2-7-3.6-3-8-6.8h-.5v.7l1.8 2.7 9.8 14.7.5 4.5-.7 1.4-2.6 1-2.7-.6-5.8-8-6-9-4.7-8.2-.5.4-2.9 30.2-1.3 1.5-3 1.2-2.5-2-1.4-3 1.4-6.2 1.6-8 1.3-6.4 1.2-7.9.7-2.6v-.2H49L43 72l-9 12.3-7.2 7.6-1.7.7-3-1.5.3-2.8L24 86l10-12.8 6-7.9 4-4.6-.1-.5h-.3L17.2 77.4l-4.7.6-2-2 .2-3 1-1 8-5.5Z" />
    </BrandSvg>
  )
}

/**
 * opencode's mark: a 4x5 cell block with a one-cell frame, an empty top row
 * and a shaded panel below (proportions from opencode.ai/brand).
 */
export function OpencodeIcon(props: IconProps) {
  return (
    <BrandSvg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path fillRule="evenodd" d="M4 2h16v20H4zm4 4v12h8V6z" />
      <rect x="8" y="10" width="8" height="8" opacity="0.3" />
    </BrandSvg>
  )
}

/** Home Assistant's house with the three-node circuit tree, in lucide's stroke style. */
export function HomeAssistantIcon(props: IconProps) {
  return (
    <BrandSvg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M12 21v-10M12 17.5l-3.75-3.34M12 15l3.75-3.34" />
      <circle cx="12" cy="10" r="1" />
      <circle cx="7.5" cy="13.5" r="1" />
      <circle cx="16.5" cy="11" r="1" />
    </BrandSvg>
  )
}
