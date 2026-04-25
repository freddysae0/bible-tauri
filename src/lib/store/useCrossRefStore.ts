import { create } from 'zustand'
import { bibleApi } from '@/lib/bibleApi'
import type { ApiCrossRef } from '@/lib/bibleApi'

interface CrossRefState {
  open: boolean
  verseApiId: number | null
  results: ApiCrossRef[]
  loading: boolean
  verseIdsWithRefs: Set<number>
  loadChapterRefs: (chapterId: number) => Promise<void>
  openPanel: (verseApiId: number) => Promise<void>
  closePanel: () => void
}

export const useCrossRefStore = create<CrossRefState>((set, get) => ({
  open: false,
  verseApiId: null,
  results: [],
  loading: false,
  verseIdsWithRefs: new Set(),

  loadChapterRefs: async (chapterId) => {
    try {
      const ids = await bibleApi.crossRefVerseIds(chapterId)
      set({ verseIdsWithRefs: new Set(ids) })
    } catch {
      // non-critical — indicators just won't show
    }
  },

  openPanel: async (verseApiId) => {
    if (get().verseApiId === verseApiId && get().open) return
    set({ open: true, verseApiId, results: [], loading: true })
    try {
      const results = await bibleApi.crossRefs(verseApiId)
      set({ results, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  closePanel: () => set({ open: false }),
}))
