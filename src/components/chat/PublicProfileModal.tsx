import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { chatApi, type PublicProfile } from '@/lib/chatApi'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useChatStore } from '@/lib/store/useChatStore'
import { useFriendStore } from '@/lib/store/useFriendStore'
import { useUIStore } from '@/lib/store/useUIStore'
import { UserAvatar } from '@/components/auth/UserAvatar'
import { cn } from '@/lib/cn'

interface PublicProfileModalProps {
  userId: number
  open: boolean
  onClose: () => void
}

type FriendBtnState = 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'blocked_by_them' | 'loading'

export function PublicProfileModal({ userId, open, onClose }: PublicProfileModalProps) {
  const { t } = useTranslation()
  const selfId = useAuthStore(s => s.user?.id)
  const addToast = useUIStore(s => s.addToast)
  const friends = useFriendStore(s => s.friends)
  const sentRequests = useFriendStore(s => s.sent)
  const receivedRequests = useFriendStore(s => s.received)
  const sendRequest = useFriendStore(s => s.sendRequest)
  const acceptRequest = useFriendStore(s => s.acceptRequest)
  const removeFriend = useFriendStore(s => s.removeFriend)
  const startDm = useChatStore(s => s.startDm)
  const selectChat = useChatStore(s => s.select)

  const isSelf = selfId !== undefined && selfId === userId

  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [friendBtn, setFriendBtn] = useState<FriendBtnState>('loading')
  const [confirmRemove, setConfirmRemove] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoadingProfile(true)
    setConfirmRemove(false)
    chatApi.getUserProfile(userId).then((p) => {
      setProfile(p)
      setLoadingProfile(false)

      // Determine friendship button state
      if (friends.some(f => f.id === userId)) {
        setFriendBtn('accepted')
      } else if (sentRequests.some(r => r.friend_id === userId || r.user_id === userId)) {
        setFriendBtn('pending_sent')
      } else if (receivedRequests.some(r => r.user_id === userId)) {
        setFriendBtn('pending_received')
      } else {
        setFriendBtn(p.friendship_status === 'blocked_by_them' ? 'blocked_by_them' : 'none')
      }
    }).catch(() => {
      setLoadingProfile(false)
      addToast(t('chat.profileLoadFailed'), 'error')
      onClose()
    })
  }, [open, userId, friends, sentRequests, receivedRequests, addToast, onClose, t])

  if (!open) return null

  const handleFriendAction = async () => {
    if (friendBtn === 'none' || friendBtn === 'blocked_by_them') {
      setFriendBtn('loading')
      try {
        await sendRequest(userId)
        setFriendBtn('pending_sent')
        addToast(t('friends.requestSentTo', { name: profile?.user.name ?? '' }), 'success')
      } catch {
        setFriendBtn('none')
        addToast(t('friends.requestFailed'), 'error')
      }
    } else if (friendBtn === 'pending_received') {
      setFriendBtn('loading')
      const req = receivedRequests.find(r => r.user_id === userId)
      if (req) {
        try {
          await acceptRequest(req.id)
          setFriendBtn('accepted')
          addToast(t('friends.requestAccepted'), 'success')
        } catch {
          setFriendBtn('pending_received')
          addToast(t('friends.acceptFailed'), 'error')
        }
      }
    } else if (friendBtn === 'accepted') {
      if (!confirmRemove) {
        setConfirmRemove(true)
        return
      }
      setFriendBtn('loading')
      try {
        await removeFriend(userId)
        setFriendBtn('none')
        setConfirmRemove(false)
        addToast(t('friends.removed', { name: profile?.user.name ?? '' }), 'info')
      } catch {
        setFriendBtn('accepted')
        setConfirmRemove(false)
        addToast(t('friends.removeFailed'), 'error')
      }
    }
  }

  const handleSendMessage = async () => {
    try {
      const c = await startDm(userId)
      selectChat(c.id)
      onClose()
    } catch {
      addToast(t('chat.createFailed'), 'error')
    }
  }

  const getFriendLabel = (): string => {
    switch (friendBtn) {
      case 'accepted': return confirmRemove ? t('friends.confirmRemove') : t('friends.removeTitle')
      case 'pending_sent': return t('friends.pending')
      case 'pending_received': return t('friends.accept')
      case 'blocked_by_them': return t('chat.blockedByUser')
      case 'loading': return t('common.loading')
      default: return t('friends.add')
    }
  }

  const friendBtnDisabled = friendBtn === 'pending_sent' || friendBtn === 'blocked_by_them' || friendBtn === 'loading'

  const hasContent = profile && (
    profile.last_reading ||
    profile.public_highlights.length > 0 ||
    profile.public_notes.length > 0 ||
    (profile.recent_likes && profile.recent_likes.length > 0)
  )

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-bg-secondary border border-border-subtle rounded-xl shadow-2xl mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle shrink-0">
          {profile && <UserAvatar email={profile.user.email} size="md" />}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">
              {profile?.user.name ?? t('common.unknown')}
            </p>
            <p className="text-2xs text-text-muted truncate">
              {profile?.user.email ?? ''}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
              <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Actions */}
        {!isSelf && (
        <div className="px-4 py-2.5 border-b border-border-subtle shrink-0 flex items-center gap-2">
          <button
            onClick={handleSendMessage}
            className="flex-1 text-xs font-medium px-3 py-1.5 rounded-md transition-colors bg-accent text-bg-primary hover:brightness-110"
          >
            {t('presence.message')}
          </button>
          <button
            onClick={handleFriendAction}
            disabled={friendBtnDisabled}
            className={cn(
              'flex-1 text-xs font-medium px-3 py-1.5 rounded-md transition-colors',
              friendBtn === 'accepted'
                ? 'bg-red-400/20 text-red-400 hover:bg-red-400/30'
                : friendBtnDisabled
                  ? 'bg-bg-tertiary text-text-muted cursor-not-allowed'
                  : 'bg-bg-primary border border-border-subtle text-text-primary hover:bg-bg-tertiary',
            )}
          >
            {getFriendLabel()}
          </button>
        </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {loadingProfile ? (
            <p className="text-xs text-text-muted text-center py-8">{t('common.loading')}</p>
          ) : !hasContent ? (
            <p className="text-xs text-text-muted text-center py-8">{t('chat.profileEmpty')}</p>
          ) : (
            <>
              {profile.last_reading && (
                <Section label={t('chat.lastReadingActivity')}>
                  <p className="text-xs text-text-primary">
                    <span className="font-medium">{profile.last_reading.book_name}</span>{' '}
                    {profile.last_reading.chapter}:{profile.last_reading.verse}
                  </p>
                  <p className="text-2xs text-text-muted mt-0.5">
                    {profile.last_reading.version}
                  </p>
                </Section>
              )}

              {profile.public_highlights.length > 0 && (
                <Section label={t('chat.publicHighlights')}>
                  {profile.public_highlights.slice(0, 5).map((h) => (
                    <div key={h.id} className="mb-2 last:mb-0">
                      <p className="text-2xs text-text-muted">{h.verse_ref}</p>
                      <p className={cn(
                        'text-xs mt-0.5 line-clamp-2',
                        h.color === 'yellow' && 'bg-yellow-500/20',
                        h.color === 'blue' && 'bg-blue-500/20',
                        h.color === 'green' && 'bg-green-500/20',
                      )}>
                        {h.text}
                      </p>
                    </div>
                  ))}
                  {profile.public_highlights.length > 5 && (
                    <p className="text-2xs text-text-muted mt-1">{t('chat.andMore', { count: profile.public_highlights.length - 5 })}</p>
                  )}
                </Section>
              )}

              {profile.public_notes.length > 0 && (
                <Section label={t('chat.publicNotes')}>
                  {profile.public_notes.slice(0, 5).map((n) => (
                    <div key={n.id} className="mb-2 last:mb-0">
                      <p className="text-2xs text-text-muted">{n.verse_ref}</p>
                      <p className="text-xs text-text-primary mt-0.5 line-clamp-3">{n.body}</p>
                    </div>
                  ))}
                  {profile.public_notes.length > 5 && (
                    <p className="text-2xs text-text-muted mt-1">{t('chat.andMore', { count: profile.public_notes.length - 5 })}</p>
                  )}
                </Section>
              )}

              {profile.recent_likes !== null && profile.recent_likes.length > 0 && (
                <Section label={t('chat.recentLikes')}>
                  {profile.recent_likes.slice(0, 5).map((l) => (
                    <div key={l.id} className="mb-2 last:mb-0">
                      <p className="text-2xs text-text-muted">{l.verse_ref}</p>
                      <p className="text-xs text-text-primary mt-0.5 line-clamp-2">{l.note_body}</p>
                    </div>
                  ))}
                </Section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wider text-text-muted mb-2">{label}</p>
      {children}
    </div>
  )
}
