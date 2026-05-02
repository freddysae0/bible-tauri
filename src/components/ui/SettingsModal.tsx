import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useUIStore, type FontSize, type Theme, type Locale } from '@/lib/store/useUIStore'
import { useVerseStore } from '@/lib/store/useVerseStore'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { usePushStore } from '@/lib/store/usePushStore'
import { UserAvatar } from '@/components/auth/UserAvatar'
import { cn } from '@/lib/cn'

const FONT_OPTIONS: { value: FontSize; label: string }[] = [
  { value: 'sm',   label: 'S' },
  { value: 'base', label: 'M' },
  { value: 'lg',   label: 'L' },
]

const LOCALE_OPTIONS: { value: Locale; label: string }[] = [
  { value: 'es', label: 'ES' },
  { value: 'en', label: 'EN' },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-2xs uppercase tracking-wider text-text-muted px-5">{title}</p>
      <div className="flex flex-col">{children}</div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-2">
      <span className="text-sm text-text-secondary">{label}</span>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <button
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
          value ? 'bg-accent' : 'bg-bg-tertiary border-border-subtle',
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
            value ? 'translate-x-4' : 'translate-x-0',
          )}
        />
      </button>
      <span className="text-sm text-text-secondary">{label}</span>
    </label>
  )
}
function SunIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-3.5 h-3.5">
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" strokeLinecap="round"/>
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-3.5 h-3.5">
      <path d="M13.5 10A6 6 0 0 1 6 2.5a6 6 0 1 0 7.5 7.5z" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function SettingsModal() {
  const { t } = useTranslation()

  const settingsOpen  = useUIStore(s => s.settingsOpen)
  const closeSettings = useUIStore(s => s.closeSettings)
  const fontSize      = useUIStore(s => s.fontSize)
  const setFontSize   = useUIStore(s => s.setFontSize)
  const theme         = useUIStore(s => s.theme)
  const setTheme      = useUIStore(s => s.setTheme)
  const locale        = useUIStore(s => s.locale)
  const setLocale     = useUIStore(s => s.setLocale)

  const versions     = useVerseStore(s => s.versions)
  const versionId    = useVerseStore(s => s.versionId)
  const loadVersions = useVerseStore(s => s.loadVersions)
  const setVersion   = useVerseStore(s => s.setVersion)

  const user   = useAuthStore(s => s.user)
  const logout = useAuthStore(s => s.logout)

  const pushSupported  = usePushStore(s => s.isSupported)
  const pushPermission = usePushStore(s => s.permission)
  const pushToken      = usePushStore(s => s.token)
  const isRequesting   = usePushStore(s => s.isRequesting)
  const pushPrefs      = usePushStore(s => s.preferences)
  const prefsLoaded    = usePushStore(s => s.preferencesLoaded)
  const startPush      = usePushStore(s => s.requestPermission)
  const stopPush       = usePushStore(s => s.disablePush)
  const loadPrefs      = usePushStore(s => s.loadPreferences)
  const updatePrefs    = usePushStore(s => s.updatePreferences)

  useEffect(() => {
    if (settingsOpen && versions.length === 0) loadVersions()
  }, [settingsOpen])

  useEffect(() => {
    if (settingsOpen && user && !prefsLoaded) loadPrefs()
  }, [settingsOpen, user])

  if (!settingsOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={closeSettings}
    >
      <div
        className="w-full max-w-sm bg-bg-secondary border border-border-subtle rounded-xl shadow-2xl mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Profile header */}
        <div className="px-5 py-5 border-b border-border-subtle">
          {user ? (
            <div className="flex items-center gap-3">
              <UserAvatar email={user.email} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{user.name}</p>
                <p className="text-xs text-text-muted truncate">{user.email}</p>
              </div>
              <button
                onClick={closeSettings}
                className="text-text-muted hover:text-text-primary transition-colors text-xl leading-none ml-1"
              >
                ×
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-muted">{t('settings.notSignedIn')}</p>
              <button
                onClick={closeSettings}
                className="text-text-muted hover:text-text-primary transition-colors text-xl leading-none"
              >
                ×
              </button>
            </div>
          )}
        </div>

        {/* Settings body */}
        <div className="py-4 flex flex-col gap-5">

          {/* Appearance */}
          <Section title={t('settings.appearance')}>
            <Row label={t('settings.theme')}>
              <div className="flex gap-1 bg-bg-tertiary rounded-lg p-1">
                {(['dark', 'light'] as Theme[]).map(th => (
                  <button
                    key={th}
                    onClick={() => setTheme(th)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                      theme === th
                        ? 'bg-bg-secondary text-text-primary shadow-sm'
                        : 'text-text-muted hover:text-text-secondary'
                    )}
                  >
                    {th === 'dark' ? <MoonIcon /> : <SunIcon />}
                    {th === 'dark' ? t('settings.theme.dark') : t('settings.theme.light')}
                  </button>
                ))}
              </div>
            </Row>

            <Row label={t('settings.language')}>
              <div className="flex gap-1 bg-bg-tertiary rounded-lg p-1">
                {LOCALE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setLocale(opt.value)}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                      locale === opt.value
                        ? 'bg-bg-secondary text-text-primary shadow-sm'
                        : 'text-text-muted hover:text-text-secondary'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Row>

            <Row label={t('settings.fontSize')}>
              <div className="flex gap-1">
                {FONT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFontSize(opt.value)}
                    className={cn(
                      'w-8 h-8 rounded-lg text-sm border font-medium transition-colors',
                      fontSize === opt.value
                        ? 'bg-accent/20 border-accent/40 text-accent'
                        : 'bg-bg-tertiary border-border-subtle text-text-secondary hover:text-text-primary',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Row>
          </Section>

          {/* Bible */}
          <Section title={t('settings.bible')}>
            <Row label={t('settings.bible.version')}>
              <select
                value={versionId}
                onChange={e => setVersion(Number(e.target.value))}
                className={cn(
                  'bg-bg-tertiary border border-border-subtle rounded-lg px-3 py-1.5',
                  'text-sm text-text-primary outline-none focus:border-accent/50 transition-colors cursor-pointer',
                )}
              >
                {versions.length === 0 && <option value={versionId}>{t('common.loading')}</option>}
                {versions.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.abbreviation} — {v.name}
                  </option>
                ))}
              </select>
            </Row>
          </Section>

          {/* Push notifications */}
          {user && pushSupported && (
            <Section title={t('settings.notifications')}>
              <Row label={t('settings.push.enable')}>
                {pushToken ? (
                  <button
                    onClick={stopPush}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    {t('settings.push.disable')}
                  </button>
                ) : (
                  <button
                    onClick={startPush}
                    disabled={isRequesting}
                    className={cn(
                      'text-xs font-medium transition-colors',
                      isRequesting ? 'text-text-muted cursor-wait' : 'text-accent hover:text-accent/80',
                    )}
                  >
                    {isRequesting ? t('common.loading') : t('settings.push.enable')}
                  </button>
                )}
              </Row>

              {pushPermission === 'denied' && (
                <div className="px-5 py-2">
                  <p className="text-xs text-text-muted">{t('settings.push.denied')}</p>
                </div>
              )}

              {pushToken && prefsLoaded && (
                <div className="flex flex-col gap-2 px-5 py-2">
                  <Toggle value={pushPrefs.chat_message} onChange={v => updatePrefs({ chat_message: v })} label={t('settings.push.chatMessage')} />
                  <Toggle value={pushPrefs.note_reply} onChange={v => updatePrefs({ note_reply: v })} label={t('settings.push.noteReply')} />
                  <Toggle value={pushPrefs.note_like} onChange={v => updatePrefs({ note_like: v })} label={t('settings.push.noteLike')} />
                  <Toggle value={pushPrefs.friend_request} onChange={v => updatePrefs({ friend_request: v })} label={t('settings.push.friendRequest')} />
                  <Toggle value={pushPrefs.friend_accepted} onChange={v => updatePrefs({ friend_accepted: v })} label={t('settings.push.friendAccepted')} />
                  <Toggle value={pushPrefs.activity_in_chapter} onChange={v => updatePrefs({ activity_in_chapter: v })} label={t('settings.push.activityInChapter')} />
                </div>
              )}
            </Section>
          )}

          {/* Account actions */}
          {user && (
            <div className="px-5 pt-1 border-t border-border-subtle mt-1">
              <button
                onClick={() => { logout(); closeSettings() }}
                className="mt-3 text-sm text-red-400 hover:text-red-300 transition-colors"
              >
                {t('settings.signOut')}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
