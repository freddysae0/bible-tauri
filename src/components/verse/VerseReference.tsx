

import { cn } from '@/lib/cn'

interface VerseReferenceProps {
  book: string
  chapter: number
  verse: number
  className?: string
}

export function VerseReference({ book, chapter, verse, className }: VerseReferenceProps) {
  const bookName = book.charAt(0).toUpperCase() + book.slice(1)

  return (
    <span className={cn('text-xs font-medium text-accent', className)}>
      {bookName} {chapter}:{verse}
    </span>
  )
}
