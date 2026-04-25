
import { useVerseStore } from '@/lib/store/useVerseStore'
import type { Book } from '@/lib/store/useVerseStore'
import { cn } from '@/lib/cn'

interface BookGroupProps {
  label: string
  books: Book[]
  selectedBook: string
  onSelect: (id: string) => void
}

function BookGroup({ label, books, selectedBook, onSelect }: BookGroupProps) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wider text-text-muted px-4 py-1 select-none">
        {label}
      </p>
      {books.map((book) => {
        const isSelected = selectedBook === book.id
        return (
          <button
            key={book.id}
            onClick={() => onSelect(book.id)}
            className={cn(
              'text-sm w-full text-left px-4 py-1 transition-colors duration-100',
              isSelected
                ? 'text-accent bg-bg-tertiary font-medium'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary',
            )}
          >
            {book.name}
          </button>
        )
      })}
    </div>
  )
}

export function BookSelector() {
  const books = useVerseStore((s) => s.books)
  const selectedBook = useVerseStore((s) => s.selectedBook)
  const selectBook = useVerseStore((s) => s.selectBook)

  const oldTestament = books.filter((b) => b.testament === 'old')
  const newTestament = books.filter((b) => b.testament === 'new')

  return (
    <div className="flex-1 overflow-y-auto py-1">
      <BookGroup
        label="Old Testament"
        books={oldTestament}
        selectedBook={selectedBook}
        onSelect={selectBook}
      />
      <div className="mt-2">
        <BookGroup
          label="New Testament"
          books={newTestament}
          selectedBook={selectedBook}
          onSelect={selectBook}
        />
      </div>
    </div>
  )
}
