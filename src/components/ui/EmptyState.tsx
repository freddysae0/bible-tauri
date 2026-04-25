

import { cn } from '@/lib/cn'

interface EmptyStateProps {
  message: string
  className?: string
}

export function EmptyState({ message, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center',
        className,
      )}
    >
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        className="text-text-muted opacity-40"
        aria-hidden="true"
      >
        <rect x="4" y="6" width="24" height="20" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M10 12h12M10 17h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <p className="text-sm text-text-muted">{message}</p>
    </div>
  )
}
