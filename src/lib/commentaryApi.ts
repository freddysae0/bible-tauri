import { api } from './api'

export interface Commentary {
  id: number
  ew_slug: string
  chapter: number
  content: string
  scraped_at: string
}

export const commentaryApi = {
  get: (bookSlug: string, chapter: number) =>
    api.get<Commentary>(`/api/commentary/${bookSlug}/${chapter}`),
}
