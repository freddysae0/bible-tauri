import { create } from 'zustand'
import { api } from '@/lib/api'

export interface BookmarkedVerse {
  id: number
  verse_id: number
  note: string | null
  created_at: string
  verse: {
    id: number
    number: number
    text: string
    chapter: number
    book: string
    slug: string
  }
}

interface BookmarkState {
  bookmarks: BookmarkedVerse[]
  bookmarkedIds: Set<number>   // set of verse_id for fast lookup
  loading: boolean
  load: () => Promise<void>
  toggle: (verseApiId: number) => Promise<void>
  isBookmarked: (verseApiId: number) => boolean
}

export const useBookmarkStore = create<BookmarkState>((set, get) => ({
  bookmarks: [],
  bookmarkedIds: new Set(),
  loading: false,

  load: async () => {
    set({ loading: true })
    try {
      const bookmarks = await api.get<BookmarkedVerse[]>('/api/user/bookmarks')
      set({
        bookmarks,
        bookmarkedIds: new Set(bookmarks.map(b => b.verse_id)),
        loading: false,
      })
    } catch {
      set({ loading: false })
    }
  },

  toggle: async (verseApiId) => {
    const { bookmarkedIds } = get()
    if (bookmarkedIds.has(verseApiId)) {
      await api.delete(`/api/verses/${verseApiId}/bookmark`)
      set(s => {
        const next = new Set(s.bookmarkedIds)
        next.delete(verseApiId)
        return {
          bookmarkedIds: next,
          bookmarks: s.bookmarks.filter(b => b.verse_id !== verseApiId),
        }
      })
    } else {
      const bookmark = await api.post<BookmarkedVerse>(`/api/verses/${verseApiId}/bookmark`, {})
      set(s => {
        const next = new Set(s.bookmarkedIds)
        next.add(verseApiId)
        return { bookmarkedIds: next, bookmarks: [...s.bookmarks, bookmark] }
      })
    }
  },

  isBookmarked: (verseApiId) => get().bookmarkedIds.has(verseApiId),
}))
