import { ChevronDown, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type Props = {
  label: string
  icon: React.ReactNode
  items: Array<{ id: string; label: string; sub?: string }>
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onAdd: () => void
  addLabel: string
  emptyLabel: string
}

export function PlaygroundDropMenu({ label, icon, items, onSelect, onDelete, onAdd, addLabel, emptyLabel }: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div className="relative" ref={wrapRef}>
      <button type="button" className="btn btn-ghost btn-xs" onClick={() => setOpen(!open)}>
        {icon}
        {label}
        <ChevronDown className="icon-10" strokeWidth={2} />
      </button>
      {open ? (
        <div className="absolute top-[calc(100%+4px)] right-0 z-20 min-w-[260px] rounded border border-border bg-surface-1 p-1.5 shadow-[0_6px_20px_-6px_rgba(0,0,0,0.4)]">
          <button
            type="button"
            className="w-full rounded-sm border border-border bg-surface-2 px-2 py-1.5 text-left text-[11px] text-fg hover:bg-surface-3"
            onClick={() => {
              setOpen(false)
              onAdd()
            }}
          >
            + {addLabel}
          </button>
          <div className="mt-1.5 flex max-h-[260px] flex-col gap-0.5 overflow-y-auto">
            {items.length === 0 ? (
              <p className="m-0 px-2 py-1.5 text-[11px] text-fg-faint">{emptyLabel}</p>
            ) : (
              items.map((it) => (
                <div key={it.id} className="flex items-center gap-1 rounded-sm hover:bg-surface-2">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 flex-col gap-px bg-transparent px-2 py-1.5 text-left text-fg"
                    onClick={() => {
                      setOpen(false)
                      onSelect(it.id)
                    }}
                  >
                    <span className="text-xs">{it.label}</span>
                    {it.sub ? <span className="font-mono text-[10px] text-fg-faint">{it.sub}</span> : null}
                  </button>
                  <button
                    type="button"
                    className="mr-1 inline-flex h-[22px] w-[22px] items-center justify-center rounded-[3px] bg-transparent text-fg-faint hover:bg-surface-3 hover:text-err"
                    onClick={() => onDelete(it.id)}
                    aria-label={`Delete ${it.label}`}
                  >
                    <X className="icon-10" strokeWidth={2.5} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
