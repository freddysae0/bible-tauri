

import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface PanelLayoutProps {
  sidebar: ReactNode
  main: ReactNode
  panel: ReactNode | null
  leftPanel?: ReactNode
}

export function PanelLayout({ sidebar, main, panel, leftPanel }: PanelLayoutProps) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg-primary">
      {/* Left sidebar — fixed width, full height */}
      <aside className="flex-shrink-0 w-sidebar h-full overflow-hidden">
        {sidebar}
      </aside>

      {/* Left panel (Favorites / My Notes) — slides in when present */}
      <aside
        className={cn(
          'flex-shrink-0 h-full overflow-hidden transition-all duration-300 ease-in-out border-r border-border-subtle',
          leftPanel != null ? 'w-panel opacity-100' : 'w-0 opacity-0 border-0',
        )}
      >
        <div className="w-panel h-full">
          {leftPanel}
        </div>
      </aside>

      {/* Center — flex-1, scrollable */}
      <main className="flex-1 min-w-0 h-full overflow-y-auto">
        {main}
      </main>

      {/* Right study panel — fixed width, slides in when present */}
      <aside
        className={cn(
          'flex-shrink-0 h-full overflow-hidden transition-all duration-300 ease-in-out',
          panel !== null ? 'w-panel opacity-100' : 'w-0 opacity-0',
        )}
      >
        <div className="w-panel h-full">
          {panel}
        </div>
      </aside>
    </div>
  )
}
