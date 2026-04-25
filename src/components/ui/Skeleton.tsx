

import { cn } from '@/lib/cn'

interface SkeletonProps {
  className?: string
  lines?: number
}

const LINE_WIDTHS = ['w-full', 'w-[85%]', 'w-[60%]'] as const

export function Skeleton({ className, lines }: SkeletonProps) {
  if (lines && lines > 1) {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-3 bg-bg-tertiary animate-pulse rounded',
              LINE_WIDTHS[i % LINE_WIDTHS.length]
            )}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className={cn('h-3 bg-bg-tertiary animate-pulse rounded w-full', className)}
    />
  )
}
