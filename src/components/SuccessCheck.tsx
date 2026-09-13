import { cn } from '../lib/cn'

export function SuccessCheck({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <span className={cn('t-success-check', className)} data-state="in" aria-hidden="true">
      <svg
        width={size}
        height={size}
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="m4 10 4 4 8-8" />
      </svg>
    </span>
  )
}
