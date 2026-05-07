import React from 'react'

interface SkeletonProps {
  className?: string
  width?: string | number
  height?: string | number
}

export function Skeleton({ className = '', width, height }: SkeletonProps) {
  return (
    <div
      className={`shimmer rounded ${className}`}
      style={{ width, height }}
    />
  )
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle">
      <Skeleton width={8} height={8} className="rounded-full flex-shrink-0" />
      <Skeleton className="flex-1" height={12} />
      <Skeleton width={80} height={12} />
      <Skeleton width={60} height={12} />
      <Skeleton width={50} height={20} className="rounded" />
      <Skeleton width={60} height={20} className="rounded" />
    </div>
  )
}

export default Skeleton
