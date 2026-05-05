import type { ReactNode } from 'react'

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
        <span className="skel skel-text" style={{ width: kickerWidth, height: 10 }} />
        <span className="skel skel-text mt-0.5" style={{ width: titleWidth, height: 24 }} />
        <div className="flex gap-2">
          <span className="skel skel-text" style={{ width: 220, height: 11 }} />
          <span className="skel skel-text max-sm:hidden" style={{ width: 120, height: 11 }} />
        </div>
      </div>
      <div className="page-header-action hidden shrink-0 items-center gap-1.5 sm:flex">
        <span className="skel skel-text rounded-sm" style={{ width: 60, height: 28 }} />
        <span className="skel skel-text rounded-full" style={{ width: 16, height: 16 }} />
      </div>
    </div>
  )
}
