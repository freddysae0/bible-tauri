

import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface PanelHeaderProps {
  title: string
  actions?: ReactNode
  className?: string
}

export function PanelHeader({ title, actions, className }: PanelHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-2.5 border-b border-border-subtle shrink-0',
        className,
      )}
    >
      <span className="text-sm font-medium text-text-secondary truncate">
        {title}
      </span>
      {actions && (
        <div className="flex items-center gap-1 ml-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  )
}
