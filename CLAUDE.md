# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

**tulia.study** — a collaborative Bible study desktop app. Stack: React + Vite + TypeScript + Tailwind + Zustand, packaged as a Tauri 2 desktop binary. The backend is a separate Laravel 13 API (`~/Documents/Repos/bible`) served from `https://tulia.study` via Contabo VPS.

## Commands

```bash
# Web dev only (Vite, port 1420)
pnpm dev

# Desktop dev (Vite + Tauri window with hot reload)
pnpm tauri:dev        # Run in PowerShell — cargo PATH is broken in Git Bash on Windows

# Build
pnpm build            # Vite → /out
pnpm tauri:build      # Full desktop binary

# Preview built web output
pnpm preview
```

> **Windows note:** Always run `pnpm tauri:dev` and `pnpm tauri:build` in PowerShell, not Git Bash — the Rust/cargo PATH is not available in Git Bash on this machine.

## Architecture

### State & Data Flow

14 Zustand stores, each owning a domain:

| Store | Responsibility |
|---|---|
| `useAuthStore` | Login/register via `/api/auth/*`, token in `localStorage` as `verbum_token` |
| `useVerseStore` | Bible versions, books, chapters — all API-backed via `bibleApi.ts` |
| `useNoteStore` | CRUD notes per verse via `/api/verses/{id}/notes` |
| `useHighlightStore` | Highlights — **still client-side only**, no backend table yet |
| `useBookmarkStore` | Bookmarks via `/api/verses/{id}/bookmark` |
| `useUIStore` | Modals, panels, theme, font size, toasts |
| `useChatStore` | Conversations, messages, WebSocket typing/read receipts via Reverb |
| `useFriendStore` | Friend requests, friends list, user search |
| `useNotificationStore` | In-app notifications + Reverb push listener (30s polling fallback) |
| `usePresenceStore` | Chapter-level presence (who's reading) |
| `useActivityStore` | Real-time verse activity (noted/highlighted) with 30s TTL |
| `usePushStore` | FCM push notifications: token registration, permission request, notification preferences |
| `useCrossRefStore` | Cross-references panel |
| `useCompareStore` | Bible version comparison modal |
| `useContextMenuStore` | Right-click context menu |

API calls go through `src/lib/api.ts` (sets `Authorization: Bearer {token}` on every request). Bible-specific endpoints are in `src/lib/bibleApi.ts`.

### UI Layout

Four-column layout managed by `PanelLayout`:

```
Sidebar (240px) │ Left Panel (420px, toggleable) │ Main │ Right Panel (420px, toggleable)
Books/Chapters  │ Favorites or My Notes          │ Verses│ Study (highlights, notes)
```

### Design System

- **Colors:** Dark theme with gold accent `#c8a96a`. All colors are CSS custom properties defined in `tailwind.config.ts` and referenced as `var(--color-*)`.
- **Font:** Inter, sizes from `2xs` (10px) to `lg` (15px) via Tailwind config.
- **Theme toggle:** sets `data-theme` attribute on `<html>`.
- **Design patterns manifesto:** `docs/design-patterns.md` — patrones de Linear (layout, espaciado, interacción, animaciones). Consultar antes de crear o modificar componentes UI.

### Routing / Navigation

No router library — navigation is state-driven. Verse IDs use the slug format `book-chapter-verse` internally; the stores also track numeric API IDs separately for backend calls.

### Backend (verbum)

`VITE_API_URL` in `.env.local` points to the Laravel API (default `http://localhost:8080`). In production it's `https://tulia.study`. CORS is configured in the backend to allow `localhost:1420` and `tauri://localhost`.

Key API shape:
- Auth: `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/logout`
- Bible: `GET /api/versions`, `GET /api/versions/{id}/books`, `GET /api/versions/{id}/books/{slug}/chapters/{n}`
- Notes: `GET|POST /api/verses/{id}/notes`, `PATCH|DELETE /api/notes/{id}`
- Bookmarks: `POST /api/verses/{id}/bookmark`
- Search: `GET /api/versions/{id}/search?q=`
- Push: `POST /api/push/subscriptions`, `DELETE /api/push/subscriptions/{token}`, `GET /api/push/subscriptions`, `GET|PATCH /api/push/preferences`

### Push Notifications

Push notifications use **Firebase Cloud Messaging (FCM)** as the single hub. A separate Firebase project `tulia-push` isolates credentials from the main `tulia-bible` hosting project.

Architecture decision: Reverb/Echo covers real-time when the user is online (foreground). FCM push fires only when the WebSocket session is not connected (offline or app closed). The backend `PushDispatcher` checks `WebSocketPresence::isOnline()` before dispatching.

**Two Firebase projects:**
| Project | Purpose |
|---------|---------|
| `tulia-bible` | Hosting only (`firebase deploy --only hosting`) |
| `tulia-push` | Cloud Messaging (FCM) — where VAPID key and service account live |

**Backend (`~/Documents/Repos/bible`):**
- `push_subscriptions` table: user_id, token (unique), platform (web/android/ios/desktop), device_label
- `notification_preferences` table: one row per user, boolean toggles per event type
- `PushDispatcher::send(User, event, payload)` — checks preferences → checks WebSocket presence → dispatches `SendPushJob` on `push` queue
- `SendPushJob` — 3 tries with exponential backoff, deletes invalid tokens (404/400)
- Queues: `default,push` via Supervisor on Contabo (`/etc/supervisor/conf.d/worker-209726.conf`)
- Credentials: `FIREBASE_CREDENTIALS=/var/www/storage/firebase-credentials.json` in `.env`
- Package: `kreait/laravel-firebase`

**Frontend (`bible-tauri`):**
- `src/lib/push.ts` — `requestAndRegister()`, `unregister()`, `onForegroundMessage()`, `detectPlatform()`, `listenForTokenRefresh()`
- `src/lib/store/usePushStore.ts` — Zustand store for permission state, token, preferences CRUD via API
- `public/firebase-messaging-sw.js` — service worker for background notifications (imports Firebase compat from CDN)
- `src/components/ui/SettingsModal.tsx` — notification preferences toggles (chat_message, note_reply, note_like, friend_request, friend_accepted, activity_in_chapter)
- `src/components/chat/ChatPanel.tsx` — push activation banner on first chat open
- `src/App.tsx` — initializes push foreground listener when user authenticates
- Package: `firebase` (JS SDK)

**Tauri desktop:**
- `@tauri-apps/plugin-notification` — native OS notifications when app is open (foreground push)
- `tauri-plugin-notification = "2"` in Cargo.toml, registered in `lib.rs`
- Platform detection (`detectPlatform()`) uses `window.__TAURI_INTERNALS__`

**Push trigger points (backend controllers):**
| Event | Controller | Method |
|-------|-----------|--------|
| `chat_message` | `ConversationController` | `sendMessage` |
| `note_reply` | `NoteController` | `store` (when parent_id set) |
| `note_like` | `NoteController` | `like` |
| `friend_request` | `FriendshipController` | `send` |
| `friend_accepted` | `FriendshipController` | `accept` |

**Environment variables (dev `VITE_`):**
```
VITE_FIREBASE_API_KEY=AIzaSyB7MYegXC6jIs2EUK6P6hwmiwqKubxVKQA
VITE_FIREBASE_PROJECT_ID=tulia-push
VITE_FIREBASE_MESSAGING_SENDER_ID=205932758475
VITE_FIREBASE_APP_ID=1:205932758475:web:1aee48ce62a48ca130e24e
VITE_FIREBASE_VAPID_PUBLIC_KEY=BFItWH6ReKCGfJ1nicQl1fcNoeHUIv9jbDnJUbcWOeAhwVgKApDS3dmcFJnbfUNpECNAtAZQEBnwMmAevHmxNDo
```

### Current Incomplete Areas

- Highlights are client-side only (`useHighlightStore` is local-only)
- `src/lib/supabase/client.ts` existe pero es código muerto — Supabase no está en el stack
- Android/iOS push (Fases 4-5) not yet implemented — requires Tauri mobile plugins
