import { create } from 'zustand'

export type VerseActivity = {
  userId: number
  userName: string
  action: 'noted' | 'highlighted'
  ts: number
}

type ActivityStore = {
  activityByVerse: Record<number, VerseActivity[]>
  recordActivity: (verseId: number, activity: VerseActivity) => void
  clearAll: () => void
}

const TTL_MS = 30_000

export const useActivityStore = create<ActivityStore>((set) => ({
  activityByVerse: {},

  recordActivity: (verseId, activity) => {
    const now = Date.now()
    set((s) => {
      const existing = (s.activityByVerse[verseId] ?? []).filter((a) => now - a.ts < TTL_MS)
      return {
        activityByVerse: {
          ...s.activityByVerse,
          [verseId]: [...existing, activity],
        },
      }
    })
  },

  clearAll: () => set({ activityByVerse: {} }),
}))
