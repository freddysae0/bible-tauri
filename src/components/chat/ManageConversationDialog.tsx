import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useChatStore } from '@/lib/store/useChatStore'
import { useFriendStore } from '@/lib/store/useFriendStore'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useUIStore } from '@/lib/store/useUIStore'
import { UserAvatar } from '@/components/auth/UserAvatar'
import { AdminTransferDialog } from './AdminTransferDialog'
import { PublicProfileModal } from './PublicProfileModal'
import { cn } from '@/lib/cn'
import type { Conversation, ChatParticipant } from '@/lib/chatApi'

interface ManageConversationDialogProps {
  conversation: Conversation
  open: boolean
  onClose: () => void
}

export function ManageConversationDialog({ conversation, open, onClose }: ManageConversationDialogProps) {
  const { t }              = useTranslation()
  const selfId             = useAuthStore(s => s.user?.id)
  const friends            = useFriendStore(s => s.friends)
  const loadFriends        = useFriendStore(s => s.load)
  const addParticipants    = useChatStore(s => s.addParticipants)
  const kickMember         = useChatStore(s => s.kickMember)
  const promoteMember      = useChatStore(s => s.promoteMember)
  const demoteMember       = useChatStore(s => s.demoteMember)
  const leave              = useChatStore(s => s.leave)
  const updateGroupSettings = useChatStore(s => s.updateGroupSettings)
  const addToast           = useUIStore(s => s.addToast)

  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [profileUserId, setProfileUserId] = useState<number | null>(null)
  const [pendingAction, setPendingAction] = useState<{ type: string; userId?: number } | null>(null)
  const [membersCanInvite, setMembersCanInvite] = useState(conversation.members_can_invite ?? true)
  const [editingName, setEditingName] = useState(false)
  const [groupName, setGroupName] = useState(conversation.name ?? '')
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    void loadFriends()
    setQuery('')
    setPicked([])
    setMembersCanInvite(conversation.members_can_invite ?? true)
    setGroupName(conversation.name ?? '')
    setEditingName(false)
  }, [open, loadFriends, conversation.members_can_invite, conversation.name])

  const participants = useMemo(() => conversation.participants, [conversation.participants])

  const currentUserIsAdmin = useMemo(
    () => selfId !== undefined && participants.some(p => p.id === selfId && p.role === 'admin'),
    [participants, selfId],
  )

  const adminCount = useMemo(
    () => participants.filter(p => p.role === 'admin').length,
    [participants],
  )

  const isLastAdmin = useCallback(
    (userId: number) => participants.some(p => p.id === userId && p.role === 'admin') && adminCount === 1,
    [participants, adminCount],
  )

  const isLastMember = participants.length === 1

  const canInvite = membersCanInvite || currentUserIsAdmin

  const existingIds = useMemo(
    () => new Set(participants.map((p) => p.id)),
    [participants],
  )

  const availableFriends = useMemo(() => {
    const q = query.trim().toLowerCase()
    return friends
      .filter((f) => !existingIds.has(f.id))
      .filter((f) => !q || f.name.toLowerCase().includes(q) || f.email.toLowerCase().includes(q))
  }, [friends, existingIds, query])

  if (!open) return null

  const togglePick = (id: number) => {
    setPicked((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  const executeAction = async (type: string, userId?: number) => {
    setBusy(true)
    try {
      switch (type) {
        case 'kick':
          if (userId) await kickMember(conversation.id, userId)
          addToast(t('chat.memberRemoved'), 'info')
          break
        case 'promote':
          if (userId) await promoteMember(conversation.id, userId)
          addToast(t('chat.memberPromoted'), 'info')
          break
        case 'demote':
          if (userId) await demoteMember(conversation.id, userId)
          addToast(t('chat.memberDemoted'), 'info')
          break
        case 'leave':
          await leave(conversation.id)
          addToast(t('chat.leftGroup'), 'info')
          onClose()
          break
      }
    } catch {
      addToast(t('chat.actionFailed'), 'error')
    } finally {
      setBusy(false)
      setPendingAction(null)
    }
  }

  const handleTransferConfirm = async (newAdminId: number) => {
    if (!pendingAction) return
    setTransferOpen(false)
    setBusy(true)
    try {
      await promoteMember(conversation.id, newAdminId)
      await executeAction(pendingAction.type, pendingAction.userId)
    } catch {
      addToast(t('chat.actionFailed'), 'error')
      setBusy(false)
      setPendingAction(null)
    }
  }

  const handleKick = (userId: number) => {
    if (busy) return
    if (isLastAdmin(userId)) {
      setPendingAction({ type: 'kick', userId })
      setTransferOpen(true)
      return
    }
    executeAction('kick', userId)
  }

  const handlePromote = (userId: number) => {
    if (busy) return
    executeAction('promote', userId)
  }

  const handleDemote = (userId: number) => {
    if (busy) return
    if (isLastAdmin(userId)) {
      setPendingAction({ type: 'demote', userId })
      setTransferOpen(true)
      return
    }
    executeAction('demote', userId)
  }

  const handleLeave = () => {
    if (busy) return
    if (isLastMember) {
      addToast(t('chat.lastMemberLeaveWarning'), 'info')
    }
    if (selfId && isLastAdmin(selfId)) {
      setPendingAction({ type: 'leave' })
      setTransferOpen(true)
      return
    }
    executeAction('leave')
  }

  const handleAdd = async () => {
    if (busy || picked.length === 0) return
    setBusy(true)
    try {
      await addParticipants(conversation.id, picked)
      addToast(t('chat.participantsAdded'), 'success')
      setPicked([])
      setQuery('')
    } catch {
      addToast(t('chat.addParticipantsFailed'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleToggleInvite = async () => {
    if (!currentUserIsAdmin || busy) return
    const newVal = !membersCanInvite
    setMembersCanInvite(newVal)
    try {
      await updateGroupSettings(conversation.id, { members_can_invite: newVal })
    } catch {
      setMembersCanInvite(!newVal)
      addToast(t('chat.settingsUpdateFailed'), 'error')
    }
  }

  const handleSaveName = async () => {
    setEditingName(false)
    const trimmed = groupName.trim()
    if (trimmed === (conversation.name ?? '')) return
    try {
      await updateGroupSettings(conversation.id, { name: trimmed || null })
    } catch {
      setGroupName(conversation.name ?? '')
      addToast(t('chat.settingsUpdateFailed'), 'error')
    }
  }

  const startEditingName = () => {
    if (!currentUserIsAdmin || busy) return
    setEditingName(true)
    setTimeout(() => nameInputRef.current?.focus(), 0)
  }

  const getTransferMembers = (): ChatParticipant[] => {
    if (!pendingAction) return []
    const excludeId = pendingAction.type === 'leave' ? selfId : pendingAction.userId
    return participants.filter(p => p.id !== excludeId)
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md bg-bg-secondary border border-border-subtle rounded-xl shadow-2xl mx-4 max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle shrink-0">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary">{t('chat.manageGroup')}</p>
              {editingName ? (
                <input
                  ref={nameInputRef}
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  onBlur={handleSaveName}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName()
                    if (e.key === 'Escape') { setGroupName(conversation.name ?? ''); setEditingName(false) }
                  }}
                  maxLength={120}
                  className="mt-1 w-full bg-bg-primary border border-accent rounded-md px-2 py-0.5 text-xs text-text-primary outline-none"
                  placeholder={t('chat.groupNamePlaceholder')}
                />
              ) : (
                <button
                  onClick={startEditingName}
                  disabled={!currentUserIsAdmin}
                  className={cn(
                    'text-2xs text-text-muted mt-0.5 flex items-center gap-1 transition-colors',
                    currentUserIsAdmin && 'hover:text-text-primary cursor-pointer',
                    !currentUserIsAdmin && 'cursor-default',
                  )}
                  title={currentUserIsAdmin ? t('chat.editGroupName') : undefined}
                >
                  <span>{conversation.name || t('chat.groupChat')}</span>
                  {currentUserIsAdmin && (
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3 opacity-50">
                      <path d="M11 2l3 3-9 9H2v-3l9-9z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label={t('common.close')}
              className="text-text-muted hover:text-text-primary transition-colors ml-2"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Group Settings */}
          <div className="px-4 py-3 border-b border-border-subtle shrink-0">
            <p className="text-2xs uppercase tracking-wider text-text-muted mb-2">{t('chat.groupSettings')}</p>
            <label className={cn(
              'flex items-center justify-between cursor-pointer',
              !currentUserIsAdmin && 'opacity-50 cursor-not-allowed',
            )}>
              <span className="text-xs text-text-primary">{t('chat.membersCanInvite')}</span>
              <button
                role="switch"
                aria-checked={membersCanInvite}
                disabled={!currentUserIsAdmin}
                onClick={handleToggleInvite}
                className={cn(
                  'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors',
                  membersCanInvite ? 'bg-accent' : 'bg-bg-tertiary border-border-subtle',
                  !currentUserIsAdmin && 'cursor-not-allowed',
                )}
              >
                <span className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  membersCanInvite ? 'translate-x-4' : 'translate-x-0',
                )} />
              </button>
            </label>
          </div>

          {/* Members */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-2xs uppercase tracking-wider text-text-muted">
                  {t('chat.members')} ({participants.length})
                </p>
              </div>
              <div className="space-y-0.5">
                {participants.map((p) => {
                  const isSelf = p.id === selfId
                  const isAdmin = p.role === 'admin'
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-bg-primary transition-colors group"
                    >
                      <button
                        onClick={() => setProfileUserId(p.id)}
                        className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                      >
                        <UserAvatar email={p.email} size="sm" />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-text-primary truncate block">
                            {p.name}
                            {isSelf && (
                              <span className="text-2xs text-text-muted ml-1">({t('chat.you')})</span>
                            )}
                          </span>
                        </div>
                      </button>
                      <span className={cn(
                        'text-3xs px-1.5 py-0.5 rounded-full font-medium',
                        isAdmin ? 'bg-accent/20 text-accent' : 'bg-bg-tertiary text-text-muted',
                      )}>
                        {isAdmin ? t('chat.roleAdmin') : t('chat.roleMember')}
                      </span>
                      {currentUserIsAdmin && !isSelf && (
                        <div className="hidden group-hover:flex items-center gap-0.5">
                          {!isAdmin ? (
                            <button
                              onClick={() => handlePromote(p.id)}
                              disabled={busy}
                              className="text-2xs text-text-muted hover:text-accent px-1 py-0.5 rounded"
                              title={t('chat.promoteToAdmin')}
                            >
                              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
                                <path d="M8 3v7M5 7l3-3 3 3" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleDemote(p.id)}
                              disabled={busy}
                              className="text-2xs text-text-muted hover:text-yellow-400 px-1 py-0.5 rounded"
                              title={t('chat.demoteToMember')}
                            >
                              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
                                <path d="M8 13V6M5 9l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={() => handleKick(p.id)}
                            disabled={busy}
                            className="text-2xs text-text-muted hover:text-red-400 px-1 py-0.5 rounded"
                            title={t('chat.removeMember')}
                          >
                            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
                              <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Add friends */}
            <div className="px-4 py-3 border-t border-border-subtle">
              <p className="text-2xs uppercase tracking-wider text-text-muted mb-2">{t('chat.addFriends')}</p>
              {!canInvite ? (
                <p className="text-2xs text-text-muted italic">{t('chat.onlyAdminsCanInvite')}</p>
              ) : (
                <>
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('chat.searchFriendsPlaceholder')}
                    className="w-full bg-bg-primary border border-border-subtle rounded-md px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-border-hover"
                  />
                  {query.trim().length > 0 && availableFriends.length === 0 ? (
                    <p className="text-xs text-text-muted py-3 text-center">{t('chat.noFriendsToAdd')}</p>
                  ) : (
                    <>
                      {availableFriends.slice(0, query.trim().length > 0 ? undefined : 5).map((friend) => {
                        const isPicked = picked.includes(friend.id)
                        return (
                          <button
                            key={friend.id}
                            onClick={() => togglePick(friend.id)}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-2 py-1.5 mt-1 rounded-md transition-colors text-left',
                              isPicked ? 'bg-bg-tertiary' : 'hover:bg-bg-primary',
                            )}
                          >
                            <UserAvatar email={friend.email} size="sm" />
                            <span className="text-sm text-text-primary truncate flex-1">{friend.name}</span>
                            <span className={cn(
                              'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                              isPicked ? 'bg-accent border-accent text-bg-primary' : 'border-border-subtle',
                            )}>
                              {isPicked && (
                                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                                  <path d="M3 8l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </span>
                          </button>
                        )
                      })}
                      {query.trim().length === 0 && availableFriends.length > 5 && (
                        <p className="text-2xs text-text-muted mt-1 px-2">
                          {t('chat.typeToSearchMore')}
                        </p>
                      )}
                      {picked.length > 0 && (
                        <button
                          onClick={() => { void handleAdd() }}
                          disabled={busy}
                          className={cn(
                            'w-full text-xs px-3 py-1.5 rounded-md font-medium transition-colors mt-2',
                            !busy
                              ? 'bg-accent text-bg-primary hover:brightness-110'
                              : 'bg-bg-tertiary text-text-muted cursor-not-allowed',
                          )}
                        >
                          {t('chat.addPeople')} ({picked.length})
                        </button>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border-subtle shrink-0">
            <button
              onClick={handleLeave}
              disabled={busy}
              className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 disabled:opacity-50"
            >
              {t('chat.leaveGroup')}
            </button>
            <button
              onClick={onClose}
              className="text-xs text-text-secondary hover:text-text-primary px-3 py-1.5"
            >
              {t('chat.done')}
            </button>
          </div>
        </div>
      </div>

      <AdminTransferDialog
        members={getTransferMembers()}
        open={transferOpen}
        onClose={() => { setTransferOpen(false); setPendingAction(null) }}
        onConfirm={handleTransferConfirm}
      />

      {profileUserId !== null && (
        <PublicProfileModal
          userId={profileUserId}
          open={profileUserId !== null}
          onClose={() => setProfileUserId(null)}
        />
      )}
    </>
  )
}
