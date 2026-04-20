import { ArrowDown, ArrowUp } from 'lucide-react'
import { cn } from '../../lib/cn'
import type { SortDir, SortKey } from './requestsListUtils'

type Props = {
  field: SortKey
  current: SortKey
  dir: SortDir
  onToggle: (k: SortKey) => void
  children: React.ReactNode
  className?: string
}

export function RequestsSortHeader({ field, current, dir, onToggle, children, className }: Props) {
  const active = current === field
  const Icon = active && dir === 'asc' ? ArrowUp : ArrowDown

  return (
    <th className={cn('sortable-th', className)} onClick={() => onToggle(field)}>
      <span className="sort-label">
        {children}
        <Icon className={cn('sort-icon', active && 'active')} size={12} strokeWidth={2} aria-hidden="true" />
      </span>
    </th>
  )
}
