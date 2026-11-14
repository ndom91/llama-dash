import { useMemo, useRef } from 'react'

// Longer than the row-enter animation, so the class stays on for the whole animation.
const FRESH_MS = 1500

/**
 * IDs of rows that arrived live, newer than any row seen before. Request IDs are ULIDs, so string
 * order is creation order. The first load, older pages, and the first result after `resetKey`
 * changes are never fresh. A virtual row that remounts on scroll replays only within FRESH_MS.
 */
export function useFreshRowIds(rows: ReadonlyArray<{ id: string }>, resetKey: unknown): ReadonlySet<string> {
  const newestRef = useRef<string | null>(null)
  const resetKeyRef = useRef(resetKey)
  const freshRef = useRef(new Map<string, number>())

  return useMemo(() => {
    if (resetKeyRef.current !== resetKey) {
      resetKeyRef.current = resetKey
      newestRef.current = null
      freshRef.current.clear()
    }
    const now = Date.now()
    const previousNewest = newestRef.current
    let newest = previousNewest
    for (const row of rows) {
      if (previousNewest != null && row.id > previousNewest) freshRef.current.set(row.id, now)
      if (newest == null || row.id > newest) newest = row.id
    }
    newestRef.current = newest
    for (const [id, seenAt] of freshRef.current) {
      if (now - seenAt > FRESH_MS) freshRef.current.delete(id)
    }
    return new Set(freshRef.current.keys())
  }, [rows, resetKey])
}
