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
    <div className="pg-dropmenu" ref={wrapRef}>
      <button type="button" className="btn btn-ghost btn-xs" onClick={() => setOpen(!open)}>
        {icon}
        {label}
        <ChevronDown className="icon-10" strokeWidth={2} />
      </button>
      {open ? (
        <div className="pg-dropmenu-panel">
          <button
            type="button"
            className="pg-dropmenu-add"
            onClick={() => {
              setOpen(false)
              onAdd()
            }}
          >
            + {addLabel}
          </button>
          <div className="pg-dropmenu-list">
            {items.length === 0 ? (
              <p className="pg-dropmenu-empty">{emptyLabel}</p>
            ) : (
              items.map((it) => (
                <div key={it.id} className="pg-dropmenu-item">
                  <button
                    type="button"
                    className="pg-dropmenu-item-main"
                    onClick={() => {
                      setOpen(false)
                      onSelect(it.id)
                    }}
                  >
                    <span className="pg-dropmenu-item-label">{it.label}</span>
                    {it.sub ? <span className="pg-dropmenu-item-sub">{it.sub}</span> : null}
                  </button>
                  <button
                    type="button"
                    className="pg-dropmenu-item-del"
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
