import { useState } from 'react'

/**
 * True once content replaces a skeleton this component showed. Pages that render cached data
 * straight away never saw a skeleton, so they do not fade in.
 */
export function useSkeletonReveal(showingSkeleton: boolean): boolean {
  const [sawSkeleton, setSawSkeleton] = useState(showingSkeleton)
  if (showingSkeleton && !sawSkeleton) setSawSkeleton(true)
  return sawSkeleton && !showingSkeleton
}
