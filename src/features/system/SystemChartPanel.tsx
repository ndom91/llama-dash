import type { ReactNode } from 'react'

export function SystemChartPanel({
  title,
  aside,
  legend,
  children,
  className,
}: {
  title: string
  aside?: ReactNode
  legend: Array<{ label: string; color: string; dashed?: boolean; band?: boolean }>
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`min-w-0 ${className ?? ''}`}>
      <div className="flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1 border-b py-2 border-border px-6 max-md:px-4">
        <h2 className="panel-title">{title}</h2>
        {aside ? <span className="font-mono text-[10px] text-fg-faint">{aside}</span> : null}
        <div className="ml-auto flex flex-wrap items-center gap-3 font-mono text-[10px] text-fg-faint">
          {legend.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1.5">
              <span
                className={item.band ? 'h-2 w-2.5 opacity-40' : 'h-px w-3'}
                style={{
                  background: item.dashed ? 'none' : item.color,
                  borderTop: item.dashed ? `1px dashed ${item.color}` : undefined,
                }}
                aria-hidden="true"
              />
              {item.label}
            </span>
          ))}
        </div>
      </div>
      <div className="px-6 pt-3 pb-4 max-md:px-4">{children}</div>
    </section>
  )
}
