export type Testament = 'old' | 'new'

export type Book = {
  id: string
  name: string
  testament: Testament
  chapters: number
}

export type Verse = {
  id: string
  book: string
  chapter: number
  verse: number
  text: string
}

export type HighlightColor = 'yellow' | 'blue' | 'green'

export type Highlight = {
  id: number
  user_id: number
  verse_id: number
  start_index: number
  end_index: number
  color: HighlightColor
}

export type Note = {
  id: string
  user_id: string
  verse_id: string
  content: string
  created_at: string
  user?: { email: string }
}

export type User = {
  id: string
  name: string
  email: string
}

export type PresenceUser = {
  id: number
  name: string
  color: string
}

export type Friend = {
  id: number
  name: string
  email: string
}

export type FriendRequest = {
  id: number
  user_id: number
  friend_id: number
  status: 'pending' | 'accepted'
  user?: Friend
  friend?: Friend
  created_at: string
}

export type AppNotification = {
  id: string
  type: string
  data: Record<string, unknown>
  read_at: string | null
  created_at: string
}

export type MemberRole = 'admin' | 'member'

export type FriendshipStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'blocked_by_them'

export interface ReadingActivity {
  book_name: string
  chapter:   number
  verse:     number
  version:   string
  timestamp: string
}

export interface PublicHighlightItem {
  id:         number
  verse_ref:  string
  text:       string
  color:      string
  created_at: string
}

export interface PublicNoteItem {
  id:         number
  verse_ref:  string
  body:       string
  created_at: string
}

export interface RecentLikeItem {
  id:         number
  verse_ref:  string
  note_body:  string
  created_at: string
}

export interface PublicProfile {
  user:              { id: number; name: string; email: string }
  last_reading:      ReadingActivity | null
  public_highlights: PublicHighlightItem[]
  public_notes:      PublicNoteItem[]
  recent_likes:      RecentLikeItem[] | null
  friendship_status: FriendshipStatus
}
