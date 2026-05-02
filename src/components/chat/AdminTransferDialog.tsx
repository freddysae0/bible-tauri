import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { UserAvatar } from '@/components/auth/UserAvatar'
import { cn } from '@/lib/cn'
import type { ChatParticipant } from '@/lib/chatApi'

interface AdminTransferDialogProps {
  members: ChatParticipant[]
  open: boolean
  onClose: () => void
  onConfirm: (newAdminId: number) => void
}

export function AdminTransferDialog({ members, open, onClose, onConfirm }: AdminTransferDialogProps) {
  const { t } = useTranslation()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  if (!open) return null

  const handleConfirm = async () => {
    if (!selectedId || busy) return
    setBusy(true)
    try {
      await onConfirm(selectedId)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-bg-secondary border border-border-subtle rounded-xl shadow-2xl mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-border-subtle">
          <p className="text-sm font-medium text-text-primary">{t('chat.transferAdminTitle')}</p>
          <p className="text-2xs text-text-muted mt-1">{t('chat.transferAdminDescription')}</p>
        </div>

        <div className="max-h-56 overflow-y-auto py-1">
          {members.map((m) => {
            const isSelected = selectedId === m.id
            return (
              <button
                key={m.id}
                onClick={() => setSelectedId(m.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-4 py-2 transition-colors text-left',
                  isSelected ? 'bg-bg-tertiary' : 'hover:bg-bg-primary',
                )}
              >
                <UserAvatar email={m.email} size="md" />
                <span className="text-sm text-text-primary">{m.name}</span>
                <span className={cn(
                  'ml-auto w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                  isSelected ? 'border-accent bg-accent' : 'border-border-subtle',
                )}>
                  {isSelected && (
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-2.5 h-2.5 text-bg-primary">
                      <path d="M3 8l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border-subtle">
          <button
            onClick={onClose}
            className="text-xs text-text-secondary hover:text-text-primary px-3 py-1.5"
          >
            {t('notes.cancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedId || busy}
            className={cn(
              'text-xs px-3 py-1.5 rounded-md font-medium transition-colors',
              selectedId && !busy
                ? 'bg-accent text-bg-primary hover:brightness-110'
                : 'bg-bg-tertiary text-text-muted cursor-not-allowed',
            )}
          >
            {busy ? t('common.loading') : t('chat.transferAndProceed')}
          </button>
        </div>
      </div>
    </div>
  )
}
