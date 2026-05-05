import type { ReactNode } from 'react'

type SkeletonSize = number | string

export function SkeletonLine({
  width,
  height,
  className = '',
}: {
  width: SkeletonSize
  height?: SkeletonSize
  className?: string
}) {
  return <span className={`skel skel-text ${className}`} style={{ width, height }} />
}

export function SkeletonBlock({
  width,
  height,
  className = '',
}: {
  width?: SkeletonSize
  height?: SkeletonSize
  className?: string
}) {
  return <span className={`skel skel-block ${className}`} style={{ width, height }} />
}

export function SkeletonPageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="content">
      <div className="page min-h-0 flex-1 bg-surface-1">{children}</div>
    </div>
  )
}

export function PageHeaderSkeleton({
  kickerWidth = 120,
  titleWidth = 180,
}: {
  kickerWidth?: number
  titleWidth?: number
}) {
  return (
    <div className="page-header page-header-integrated flex items-start justify-between gap-4">
      <div className="page-header-copy flex flex-1 flex-col gap-0.5">
        <SkeletonLine width={kickerWidth} height={10} />
        <SkeletonLine width={titleWidth} height={24} className="mt-0.5" />
        <div className="flex gap-2">
          <SkeletonLine width={220} height={11} />
          <SkeletonLine width={120} height={11} className="max-sm:hidden" />
        </div>
      </div>
      <div className="page-header-action hidden shrink-0 items-center gap-1.5 sm:flex">
        <SkeletonLine width={60} height={28} className="rounded-sm" />
        <SkeletonLine width={16} height={16} className="rounded-full" />
      </div>
    </div>
  )
}
