import { api } from '@/lib/api'

export type MemberRole = 'admin' | 'member'

export interface ChatUser {
  id:    number
  name:  string
  email: string
}

export interface ChatParticipant extends ChatUser {
  last_read_at: string | null
  role?:         MemberRole
}

export interface ChatLastMessagePreview {
  id:         number
  user_id:    number
  user_name:  string | null
  body:       string
  created_at: string
}

export interface GroupSettings {
  members_can_invite: boolean
  name?:              string
}

export interface Conversation {
  id:                  number
  type:                'dm' | 'group'
  name:                string | null
  created_by:          number
  last_message_at:     string | null
  unread_count:        number
  last_read_at:        string | null
  participants:        ChatParticipant[]
  last_message:        ChatLastMessagePreview | null
  members_can_invite?: boolean
}

export interface ChatMessage {
  id:              number
  conversation_id: number
  user_id:         number
  user:            ChatUser | null
  body:            string
  created_at:      string
}

export type FriendshipStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'blocked_by_them'

export interface ReadingActivity {
  book_name: string
  chapter:   number
  verse:     number
  version:   string
  timestamp: string
}

export interface PublicProfile {
  user:                ChatUser
  last_reading:        ReadingActivity | null
  public_highlights:   PublicHighlight[]
  public_notes:        PublicNote[]
  recent_likes:        RecentLike[] | null
  friendship_status:   FriendshipStatus
}

export interface PublicHighlight {
  id:        number
  verse_ref: string
  text:      string
  color:     string
  created_at: string
}

export interface PublicNote {
  id:         number
  verse_ref:  string
  body:       string
  created_at: string
}

export interface RecentLike {
  id:         number
  verse_ref:  string
  note_body:  string
  created_at: string
}

export const chatApi = {
  list:           ()                            => api.get<Conversation[]>('/api/conversations'),
  show:           (id: number)                  => api.get<Conversation>(`/api/conversations/${id}`),
  createDm:       (userId: number)              => api.post<Conversation>('/api/conversations', { type: 'dm', user_ids: [userId] }),
  createGroup:    (name: string, userIds: number[]) => api.post<Conversation>('/api/conversations', { type: 'group', name, user_ids: userIds }),
  messages:       (id: number, before?: number) => api.get<ChatMessage[]>(`/api/conversations/${id}/messages${before ? `?before=${before}` : ''}`),
  send:           (id: number, body: string)    => api.post<ChatMessage>(`/api/conversations/${id}/messages`, { body }),
  markRead:       (id: number)                  => api.post<{ last_read_at: string; last_read_message_id: number | null }>(`/api/conversations/${id}/read`, {}),
  typing:         (id: number)                  => api.post<{ ok: boolean }>(`/api/conversations/${id}/typing`, {}),
  addParticipants:(id: number, userIds: number[]) => api.post<Conversation>(`/api/conversations/${id}/participants`, { user_ids: userIds }),
  leave:          (id: number)                  => api.delete<void>(`/api/conversations/${id}/leave`),

  // Member management
  kickMember:     (convId: number, userId: number) => api.delete<Conversation>(`/api/conversations/${convId}/members/${userId}`),
  promoteMember:  (convId: number, userId: number) => api.post<Conversation>(`/api/conversations/${convId}/members/${userId}/promote`, {}),
  demoteMember:   (convId: number, userId: number) => api.post<Conversation>(`/api/conversations/${convId}/members/${userId}/demote`, {}),

  // Group settings
  getSettings:    (id: number)                     => api.get<GroupSettings>(`/api/conversations/${id}/settings`),
  updateSettings: (id: number, settings: Partial<GroupSettings>) => api.patch<GroupSettings>(`/api/conversations/${id}/settings`, settings),

  // Public profile
  getUserProfile: (userId: number)                 => api.get<PublicProfile>(`/api/users/${userId}/profile`),
}
