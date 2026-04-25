import { create } from 'zustand'
import { api } from '@/lib/api'
import type { Highlight, HighlightColor } from '@/types'

const isAuthenticated = () => !!localStorage.getItem('verbum_token')

interface HighlightState {
  highlights: Record<number, Highlight[]>   // keyed by verseApiId
  loading: Record<number, boolean>
  loadHighlightsForChapter: (verseApiIds: number[]) => Promise<void>
  loadHighlights: (verseApiId: number) => Promise<void>
  addHighlight: (verseApiId: number, start: number, end: number, color: HighlightColor) => Promise<void>
  removeHighlight: (verseApiId: number, highlightId: number) => Promise<void>
}

export const useHighlightStore = create<HighlightState>((set, get) => ({
  highlights: {},
  loading: {},

  loadHighlightsForChapter: async (verseApiIds) => {
    if (!verseApiIds.length || !isAuthenticated()) return
    try {
      const all = await api.post<Highlight[]>('/api/highlights/batch', { verse_ids: verseApiIds })
      const grouped: Record<number, Highlight[]> = {}
      for (const id of verseApiIds) grouped[id] = []
      for (const h of all) {
        grouped[h.verse_id] = [...(grouped[h.verse_id] ?? []), h]
      }
      set(s => ({ highlights: { ...s.highlights, ...grouped } }))
    } catch {
      // Not logged in or network error — silently skip
    }
  },

  loadHighlights: async (verseApiId) => {
    if (get().loading[verseApiId] || !isAuthenticated()) return
    set(s => ({ loading: { ...s.loading, [verseApiId]: true } }))
    try {
      const highlights = await api.get<Highlight[]>(`/api/verses/${verseApiId}/highlights`)
      set(s => ({
        highlights: { ...s.highlights, [verseApiId]: highlights },
        loading: { ...s.loading, [verseApiId]: false },
      }))
    } catch {
      set(s => ({ loading: { ...s.loading, [verseApiId]: false } }))
    }
  },

  addHighlight: async (verseApiId, start, end, color) => {
    const highlight = await api.post<Highlight>(`/api/verses/${verseApiId}/highlights`, {
      start_index: start,
      end_index: end,
      color,
    })
    set(s => ({
      highlights: {
        ...s.highlights,
        [verseApiId]: [...(s.highlights[verseApiId] ?? []), highlight],
      },
    }))
  },

  removeHighlight: async (verseApiId, highlightId) => {
    await api.delete(`/api/highlights/${highlightId}`)
    set(s => ({
      highlights: {
        ...s.highlights,
        [verseApiId]: (s.highlights[verseApiId] ?? []).filter(h => h.id !== highlightId),
      },
    }))
  },
}))
