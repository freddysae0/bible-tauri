import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useChatStore } from '@/lib/store/useChatStore'
import { useUIStore } from '@/lib/store/useUIStore'
import { usePushStore } from '@/lib/store/usePushStore'
import { ConversationList } from './ConversationList'
import { ChatThread } from './ChatThread'
import { NewChatDialog } from './NewChatDialog'

const PUSH_BANNER_DISMISSED_KEY = 'verbum_push_banner_dismissed'

export function ChatPanel() {
  const closePanel    = useUIStore(s => s.closePanel)
  const conversations = useChatStore(s => s.conversations)
  const selectedId    = useChatStore(s => s.selectedId)
  const load          = useChatStore(s => s.load)
  const select        = useChatStore(s => s.select)

  const { t } = useTranslation()
  const [composerOpen, setComposerOpen] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(
    localStorage.getItem(PUSH_BANNER_DISMISSED_KEY) === 'true'
  )

  const pushSupported  = usePushStore(s => s.isSupported)
  const pushToken      = usePushStore(s => s.token)
  const requestPush    = usePushStore(s => s.requestPermission)

  const showBanner = !pushToken && !bannerDismissed

  const dismissBanner = () => {
    localStorage.setItem(PUSH_BANNER_DISMISSED_KEY, 'true')
    setBannerDismissed(true)
  }

  useEffect(() => { load() }, [load])

  const selected = conversations.find(c => c.id === selectedId) ?? null

  return (
    <div className="w-full h-full bg-bg-primary flex flex-col overflow-hidden">
      {showBanner && (
        <div className="px-3 py-2 mx-3 mt-2 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-between gap-2 shrink-0">
          <span className="text-xs text-text-secondary">{t('settings.push.banner')}</span>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={requestPush}
              className="text-xs font-medium text-accent hover:text-accent/80 transition-colors"
            >
              {t('settings.push.banner.activate')}
            </button>
            <button
              onClick={dismissBanner}
              className="text-text-muted hover:text-text-primary transition-colors text-sm leading-none ml-1"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {selected ? (
        <ChatThread conversation={selected} onBack={() => select(null)} />
      ) : (
        <>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle shrink-0">
            <span className="text-sm font-medium text-text-primary">{t('nav.chat')}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setComposerOpen(true)}
                aria-label={t('common.newChat')}
                title={t('common.newChat')}
                className="text-text-muted hover:text-text-primary transition-colors p-1 rounded hover:bg-bg-tertiary"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                  <path d="M8 3.5v9M3.5 8h9" strokeLinecap="round" />
                </svg>
              </button>
              <button
                onClick={closePanel}
                aria-label={t('chat.closeChat')}
                className="text-text-muted hover:text-text-primary transition-colors p-1 rounded hover:bg-bg-tertiary"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                  <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          <ConversationList />
        </>
      )}

      <NewChatDialog open={composerOpen} onClose={() => setComposerOpen(false)} />
    </div>
  )
}
