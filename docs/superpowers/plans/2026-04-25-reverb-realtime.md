# Reverb Real-Time Collaborative Reading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real-time presence (see which friends are reading the same chapter) and verse-level activity notifications (highlights, notes) using Laravel Reverb WebSockets, replacing the current polling-only approach.

**Architecture:** Laravel Reverb (Pusher-protocol WebSocket server) is already installed at `localhost:8080`. The frontend connects via laravel-echo's reverb broadcaster. A `chapter.{chapterId}` presence channel tracks who is reading; `VerseActivityEvent` broadcasts there when friends note or highlight verses. Friendship notifications gain a `broadcast` channel alongside the existing `database` channel for instant delivery.

**Tech Stack:** Laravel Reverb 1.10, laravel-echo (≥1.16), pusher-js, Zustand 5, React 18, Tauri 2

---

## Codebase Context

### Backend (C:\Repos\verbum)
- Reverb is already configured in `.env`: `BROADCAST_CONNECTION=reverb`, `REVERB_HOST=localhost`, `REVERB_PORT=8080`
- `config/reverb.php` has `'allowed_origins' => ['*']` — no CORS changes needed
- `routes/channels.php` defines two channels: `App.Models.User.{id}` (private) and `chapter.{chapterId}` (presence, returns `{id, name, color}`)
- `FriendshipObserver` + `FriendRequestReceived`/`FriendRequestAccepted` notifications already exist — both are database-only
- `VerseComment` = the "notes" model (used by `NoteController`); `VerseHighlight` = highlights model
- `app/Events/` is empty — no broadcast events exist yet

### Frontend (C:\Repos\tulia-study)
- `src/components/realtime/PresenceAvatars.tsx` exists but uses a stale `PresenceUser` type (wrong fields)
- `src/lib/api.ts` stores auth token in `localStorage` under key `verbum_token`
- `src/lib/bibleApi.ts` has `ApiChapterResponse` — missing `chapter_id`
- `src/lib/store/useVerseStore.ts` — missing `chapterId: number | null` state
- No `laravel-echo` or `pusher-js` installed
- `.env.local` currently has `VITE_API_URL=https://verbum.test` — change to `http://localhost:8000` for local dev

---

## File Map

### verbum
- Modify: `app/Http/Controllers/Api/BibleController.php` — include `chapter_id` in chapter response
- Create: `app/Events/VerseActivityEvent.php` — ShouldBroadcastNow on `chapter.{chapterId}` presence channel
- Create: `app/Observers/VerseCommentObserver.php` — fires VerseActivityEvent when note created
- Create: `app/Observers/VerseHighlightObserver.php` — fires VerseActivityEvent when highlight created
- Modify: `app/Providers/AppServiceProvider.php` — register both new observers
- Modify: `app/Notifications/FriendRequestReceived.php` — add `'broadcast'` to via(); implement ShouldBroadcast
- Modify: `app/Notifications/FriendRequestAccepted.php` — add `'broadcast'` to via(); implement ShouldBroadcast
- Modify: `routes/channels.php` — add `Broadcast::routes()` to register `/broadcasting/auth` endpoint
- Modify: `.env` — change QUEUE_CONNECTION to `sync` for dev (broadcast notifications bypass queue)

### tulia-study
- Modify: `.env.local` — add VITE_REVERB_* vars; fix VITE_API_URL to localhost
- Modify: `src/lib/bibleApi.ts` — add `chapter_id: number` to `ApiChapterResponse`
- Modify: `src/types/index.ts` — fix `PresenceUser` to match channels.php: `{id, name, color}`
- Modify: `src/lib/store/useVerseStore.ts` — add `chapterId: number | null`; store from API response
- Create: `src/lib/echo.ts` — lazily-initialized Echo singleton; reads token from `localStorage`
- Create: `src/lib/store/useActivityStore.ts` — pure state for recent friend verse activity (30s TTL)
- Create: `src/lib/store/usePresenceStore.ts` — joins/leaves presence channel; populates activity store and fires toasts
- Modify: `src/components/realtime/PresenceAvatars.tsx` — adapt to new `{id, name, color}` PresenceUser type
- Modify: `src/components/layout/BreadcrumbBar.tsx` — show PresenceAvatars on the right
- Modify: `src/components/verse/VerseList.tsx` — join channel on mount; show friend activity pulse on verse numbers
- Modify: `src/lib/store/useNotificationStore.ts` — add `listenForPush`/`stopPush` via private channel
- Modify: `src/components/sidebar/Sidebar.tsx` — wire `listenForPush`/`stopPush` to login/logout lifecycle

---

## Task 1: Backend — Add chapter_id to chapter API response

**Files:**
- Modify: `C:\Repos\verbum\app\Http\Controllers\Api\BibleController.php`

The `chapter.{chapterId}` presence channel requires the chapter's database integer ID. Currently `BibleController::chapter()` returns book info, chapter number, and verses but omits the chapter's `id`. The `$chapter` Eloquent object already has it.

- [ ] **Step 1: Add chapter_id to the JSON response**

Open `C:\Repos\verbum\app\Http\Controllers\Api\BibleController.php`.

Find the `return response()->json([...])` at the end of `chapter()` (around line 45). Replace it:

```php
        return response()->json([
            'book'       => ['number' => $book->number, 'name' => $book->name, 'slug' => $book->slug],
            'chapter'    => $chapterNumber,
            'chapter_id' => $chapter->id,
            'verses'     => $verses,
        ]);
```

- [ ] **Step 2: Verify the endpoint returns chapter_id**

Start verbum if not running (`php artisan serve` in a PowerShell tab).

```bash
curl -s "http://localhost:8000/api/versions/1/books/genesis/chapters/1" | python -m json.tool | findstr chapter_id
```

Expected: `"chapter_id": 1,`

- [ ] **Step 3: Commit**

```bash
cd C:\Repos\verbum
git add app/Http/Controllers/Api/BibleController.php
git commit -m "feat(api): include chapter_id in chapter endpoint response"
```

---

## Task 2: Backend — Create VerseActivityEvent

**Files:**
- Create: `C:\Repos\verbum\app\Events\VerseActivityEvent.php`

This event is broadcast **synchronously** (`ShouldBroadcastNow`, no queue needed) to the `chapter.{chapterId}` presence channel. All users subscribed to that channel receive it immediately. The `broadcastWith()` method explicitly returns snake_case keys so the frontend payload is predictable.

- [ ] **Step 1: Create the Events directory**

```powershell
New-Item -ItemType Directory -Path "C:\Repos\verbum\app\Events" -Force
```

- [ ] **Step 2: Create VerseActivityEvent.php**

Create `C:\Repos\verbum\app\Events\VerseActivityEvent.php`:

```php
<?php

namespace App\Events;

use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Queue\SerializesModels;

class VerseActivityEvent implements ShouldBroadcastNow
{
    use SerializesModels;

    public function __construct(
        public readonly int $verseId,
        public readonly int $chapterId,
        public readonly int $userId,
        public readonly string $userName,
        public readonly string $action,  // 'noted' | 'highlighted'
    ) {}

    public function broadcastOn(): array
    {
        return [new PresenceChannel('chapter.' . $this->chapterId)];
    }

    public function broadcastAs(): string
    {
        return 'verse.activity';
    }

    public function broadcastWith(): array
    {
        return [
            'verse_id'   => $this->verseId,
            'chapter_id' => $this->chapterId,
            'user_id'    => $this->userId,
            'user_name'  => $this->userName,
            'action'     => $this->action,
        ];
    }
}
```

- [ ] **Step 3: Verify the class loads**

```bash
cd C:\Repos\verbum
php artisan tinker --execute="echo (new App\Events\VerseActivityEvent(1,1,1,'Test','noted'))->broadcastAs();"
```

Expected output: `verse.activity`

- [ ] **Step 4: Commit**

```bash
git add app/Events/VerseActivityEvent.php
git commit -m "feat(events): add VerseActivityEvent for real-time verse notifications"
```

---

## Task 3: Backend — Create observers for verse activity

**Files:**
- Create: `C:\Repos\verbum\app\Observers\VerseCommentObserver.php`
- Create: `C:\Repos\verbum\app\Observers\VerseHighlightObserver.php`
- Modify: `C:\Repos\verbum\app\Providers\AppServiceProvider.php`

When a user creates a note (`VerseComment`) or highlight (`VerseHighlight`), the observer fires `VerseActivityEvent` on that verse's chapter channel. The `Verse` model has a `chapter_id` column directly, so no extra join is needed.

- [ ] **Step 1: Create VerseCommentObserver.php**

Create `C:\Repos\verbum\app\Observers\VerseCommentObserver.php`:

```php
<?php

namespace App\Observers;

use App\Events\VerseActivityEvent;
use App\Models\VerseComment;

class VerseCommentObserver
{
    public function created(VerseComment $comment): void
    {
        $verse = $comment->verse;

        event(new VerseActivityEvent(
            verseId:   $verse->id,
            chapterId: $verse->chapter_id,
            userId:    $comment->user_id,
            userName:  $comment->user->name ?? 'Someone',
            action:    'noted',
        ));
    }
}
```

- [ ] **Step 2: Create VerseHighlightObserver.php**

Create `C:\Repos\verbum\app\Observers\VerseHighlightObserver.php`:

```php
<?php

namespace App\Observers;

use App\Events\VerseActivityEvent;
use App\Models\VerseHighlight;

class VerseHighlightObserver
{
    public function created(VerseHighlight $highlight): void
    {
        $verse = $highlight->verse;

        event(new VerseActivityEvent(
            verseId:   $verse->id,
            chapterId: $verse->chapter_id,
            userId:    $highlight->user_id,
            userName:  $highlight->user->name ?? 'Someone',
            action:    'highlighted',
        ));
    }
}
```

- [ ] **Step 3: Register the observers in AppServiceProvider**

Replace `C:\Repos\verbum\app\Providers\AppServiceProvider.php` with:

```php
<?php

namespace App\Providers;

use App\Models\CommentLike;
use App\Models\Friendship;
use App\Models\SelectionComment;
use App\Models\VerseComment;
use App\Models\VerseHighlight;
use App\Observers\CommentLikeObserver;
use App\Observers\FriendshipObserver;
use App\Observers\SelectionCommentObserver;
use App\Observers\VerseCommentObserver;
use App\Observers\VerseHighlightObserver;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        CommentLike::observe(CommentLikeObserver::class);
        SelectionComment::observe(SelectionCommentObserver::class);
        Friendship::observe(FriendshipObserver::class);
        VerseComment::observe(VerseCommentObserver::class);
        VerseHighlight::observe(VerseHighlightObserver::class);
    }
}
```

- [ ] **Step 4: Verify observers register without errors**

```bash
cd C:\Repos\verbum
php artisan tinker --execute="
\$verse = App\Models\Verse::with('chapter')->first();
echo 'verse id=' . \$verse->id . ' chapter_id=' . \$verse->chapter_id;
"
```

Expected: `verse id=1 chapter_id=1` (confirming verse has chapter_id column).

- [ ] **Step 5: Commit**

```bash
git add app/Observers/VerseCommentObserver.php app/Observers/VerseHighlightObserver.php app/Providers/AppServiceProvider.php
git commit -m "feat(observers): broadcast VerseActivityEvent on note and highlight creation"
```

---

## Task 4: Backend — Broadcast friendship notifications + register auth route

**Files:**
- Modify: `C:\Repos\verbum\app\Notifications\FriendRequestReceived.php`
- Modify: `C:\Repos\verbum\app\Notifications\FriendRequestAccepted.php`
- Modify: `C:\Repos\verbum\routes\channels.php`
- Modify: `C:\Repos\verbum\.env`

Friend requests currently only notify via the `database` channel (polled every 30s). This task adds `broadcast` so the recipient's private channel `App.Models.User.{id}` receives the notification instantly.

The `broadcast` channel in Laravel requires `/broadcasting/auth` to be registered. `QUEUE_CONNECTION=sync` is set so broadcasts fire during the request (no background worker needed in development).

**Important:** When Laravel broadcasts a notification, the `type` key in the payload is the full PHP class name (e.g., `App\Notifications\FriendRequestReceived`). The frontend uses this class name to identify the notification — NOT the `type` key from `toArray()`.

- [ ] **Step 1: Update FriendRequestReceived to broadcast**

Replace `C:\Repos\verbum\app\Notifications\FriendRequestReceived.php`:

```php
<?php

namespace App\Notifications;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Notification;

class FriendRequestReceived extends Notification implements ShouldBroadcast
{
    use Queueable;

    public function __construct(public User $requester) {}

    public function via(object $notifiable): array
    {
        return ['database', 'broadcast'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type'           => 'friend_request_received',
            'requester_id'   => $this->requester->id,
            'requester_name' => $this->requester->name,
        ];
    }

    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage([
            'requester_id'   => $this->requester->id,
            'requester_name' => $this->requester->name,
        ]);
    }
}
```

- [ ] **Step 2: Update FriendRequestAccepted to broadcast**

Replace `C:\Repos\verbum\app\Notifications\FriendRequestAccepted.php`:

```php
<?php

namespace App\Notifications;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Notification;

class FriendRequestAccepted extends Notification implements ShouldBroadcast
{
    use Queueable;

    public function __construct(public User $acceptor) {}

    public function via(object $notifiable): array
    {
        return ['database', 'broadcast'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type'          => 'friend_request_accepted',
            'acceptor_id'   => $this->acceptor->id,
            'acceptor_name' => $this->acceptor->name,
        ];
    }

    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage([
            'acceptor_id'   => $this->acceptor->id,
            'acceptor_name' => $this->acceptor->name,
        ]);
    }
}
```

- [ ] **Step 3: Register the broadcast auth route in channels.php**

Replace `C:\Repos\verbum\routes\channels.php` with:

```php
<?php

use App\Models\Chapter;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::routes(['middleware' => ['auth:sanctum']]);

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('chapter.{chapterId}', function (User $user, int $chapterId) {
    if (!Chapter::find($chapterId)) return false;

    return [
        'id'    => $user->id,
        'name'  => $user->name,
        'color' => '#' . substr(md5((string) $user->id), 0, 6),
    ];
});
```

- [ ] **Step 4: Set QUEUE_CONNECTION=sync in verbum .env**

In `C:\Repos\verbum\.env`, find the line:
```
QUEUE_CONNECTION=database
```

Change it to:
```
QUEUE_CONNECTION=sync
```

- [ ] **Step 5: Restart verbum server and verify /broadcasting/auth route exists**

Stop `php artisan serve` (Ctrl+C) and restart it.

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8000/broadcasting/auth -H "Accept: application/json"
```

Expected: `401` (unauthorized — but the route exists). A `404` would mean the route isn't registered.

- [ ] **Step 6: Commit**

```bash
cd C:\Repos\verbum
git add app/Notifications/FriendRequestReceived.php app/Notifications/FriendRequestAccepted.php routes/channels.php .env
git commit -m "feat(notifications): add broadcast channel to friendship notifications; register Broadcast::routes()"
```

---

## Task 5: Frontend — Install packages + update .env.local

**Files:**
- Package install (package.json updated automatically)
- Modify: `C:\Repos\tulia-study\.env.local`

`laravel-echo` provides the WebSocket client API. `pusher-js` is the underlying transport (Reverb uses the Pusher protocol). The `reverb` broadcaster in laravel-echo ≥ 1.16 wraps pusher-js without requiring `window.Pusher`.

- [ ] **Step 1: Install packages**

In a PowerShell terminal at `C:\Repos\tulia-study`:

```powershell
pnpm add laravel-echo pusher-js
```

Expected: both packages listed in `dependencies` in `package.json`.

- [ ] **Step 2: Confirm laravel-echo version supports reverb broadcaster**

```powershell
pnpm list laravel-echo
```

Expected version: `1.16.x` or higher. If lower than `1.16`, run:
```powershell
pnpm add laravel-echo@^1.16
```

- [ ] **Step 3: Update .env.local**

Replace the full contents of `C:\Repos\tulia-study\.env.local`:

```
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_API_URL=http://localhost:8000
VITE_REVERB_APP_KEY=ozsaw3wiiiqv2abutumj
VITE_REVERB_HOST=localhost
VITE_REVERB_PORT=8080
VITE_REVERB_SCHEME=http
```

Note: `VITE_API_URL` changed from `https://verbum.test` to `http://localhost:8000` for local dev.

---

## Task 6: Frontend — Update types + useVerseStore

**Files:**
- Modify: `C:\Repos\tulia-study\src\types\index.ts`
- Modify: `C:\Repos\tulia-study\src\lib\bibleApi.ts`
- Modify: `C:\Repos\tulia-study\src\lib\store\useVerseStore.ts`

The existing `PresenceUser` type has wrong fields — it doesn't match what `routes/channels.php` returns (`{id, name, color}`). `ApiChapterResponse` needs `chapter_id`. `useVerseStore` needs to hold `chapterId` so presence and activity stores know which channel to join.

- [ ] **Step 1: Fix PresenceUser in src/types/index.ts**

Open `C:\Repos\tulia-study\src\types\index.ts`.

Find and replace the `PresenceUser` type:

Old:
```typescript
export type PresenceUser = {
  user_id: string
  email: string
  chapter_id: string
  online_at: string
}
```

New:
```typescript
export type PresenceUser = {
  id: number
  name: string
  color: string
}
```

- [ ] **Step 2: Add chapter_id to ApiChapterResponse in bibleApi.ts**

Open `C:\Repos\tulia-study\src\lib\bibleApi.ts`.

Find the `ApiChapterResponse` interface and replace it:

```typescript
export interface ApiChapterResponse {
  book: { number: number; name: string; slug: string }
  chapter: number
  chapter_id: number
  verses: ApiVerse[]
}
```

- [ ] **Step 3: Add chapterId state to useVerseStore**

Open `C:\Repos\tulia-study\src\lib\store\useVerseStore.ts`.

In the `VerseState` interface, add `chapterId` after `selectedVerseId`:
```typescript
  selectedVerseId: string | null
  chapterId: number | null
  verses: Verse[]
```

In the `create` call initial state, add `chapterId` after `selectedVerseId`:
```typescript
  selectedVerseId: null,
  chapterId: null,
  verses: [],
```

In `loadChapter`, update the `set()` call inside the try block to include `chapterId`:
```typescript
      set({ verses, chapterId: data.chapter_id, loadingVerses: false })
```

(The `data` object is already the `ApiChapterResponse`, which now has `chapter_id`.)

- [ ] **Step 4: Verify TypeScript compiles**

```powershell
cd C:\Repos\tulia-study
pnpm tsc --noEmit
```

Expected: no errors from the files changed in this task.

---

## Task 7: Frontend — Create echo.ts singleton

**Files:**
- Create: `C:\Repos\tulia-study\src\lib\echo.ts`

A module-level singleton for the Laravel Echo WebSocket connection. `initEcho()` reads the Sanctum Bearer token from `localStorage` at call time (key: `verbum_token`, same as `src/lib/api.ts`). Calling `initEcho()` when already initialized returns the existing instance. `destroyEcho()` disconnects and clears the singleton (called on logout).

The `reverb` broadcaster internally uses pusher-js. Passing `Pusher` as an option makes this explicit and avoids relying on `window.Pusher`.

- [ ] **Step 1: Create src/lib/echo.ts**

```typescript
import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

let _echo: Echo | null = null

export function initEcho(): Echo {
  if (_echo) return _echo

  const token = localStorage.getItem('verbum_token') ?? ''

  _echo = new Echo({
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY,
    wsHost: import.meta.env.VITE_REVERB_HOST ?? 'localhost',
    wsPort: Number(import.meta.env.VITE_REVERB_PORT ?? 8080),
    wssPort: Number(import.meta.env.VITE_REVERB_PORT ?? 8080),
    forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'http') === 'https',
    enabledTransports: ['ws', 'wss'],
    authEndpoint: `${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}/broadcasting/auth`,
    auth: {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    },
    Pusher,
  })

  return _echo
}

export function getEcho(): Echo | null {
  return _echo
}

export function destroyEcho(): void {
  _echo?.disconnect()
  _echo = null
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```powershell
pnpm tsc --noEmit
```

Expected: no errors. If `Cannot find module 'laravel-echo'`, re-run `pnpm install`.

---

## Task 8: Frontend — Create useActivityStore

**Files:**
- Create: `C:\Repos\tulia-study\src\lib\store\useActivityStore.ts`

Pure Zustand state store for tracking recent friend verse activity. `usePresenceStore` will call `useActivityStore.getState().recordActivity(...)` when a `verse.activity` WebSocket event arrives. `VerseList` reads `activityByVerse` to show a pulsing dot.

Entries expire after 30 seconds. Expiry is checked lazily on each `recordActivity` call (no timer needed).

- [ ] **Step 1: Create src/lib/store/useActivityStore.ts**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```powershell
pnpm tsc --noEmit
```

---

## Task 9: Frontend — Create usePresenceStore

**Files:**
- Create: `C:\Repos\tulia-study\src\lib\store\usePresenceStore.ts`

Manages joining/leaving the `chapter.{chapterId}` presence channel. Tracks `others` — other users currently reading the same chapter (the current user is excluded). When a `.verse.activity` event arrives, it writes to `useActivityStore` and fires a UI toast.

Only one chapter channel is active at a time. Joining a new chapter automatically leaves the previous one.

**Event listener note:** The `.listen('.verse.activity', ...)` leading dot tells Echo the event name is already fully-qualified, matching `broadcastAs(): 'verse.activity'` in `VerseActivityEvent`. Without the dot, Echo would prepend the app namespace.

- [ ] **Step 1: Create src/lib/store/usePresenceStore.ts**

```typescript
import { create } from 'zustand'
import type { PresenceUser } from '@/types'
import { initEcho, getEcho } from '@/lib/echo'
import { useActivityStore } from './useActivityStore'
import { useUIStore } from './useUIStore'

type PresenceStore = {
  others: PresenceUser[]
  joinChapter: (chapterId: number, selfId: string) => void
  leaveChapter: () => void
}

let _channelName: string | null = null

export const usePresenceStore = create<PresenceStore>((set) => ({
  others: [],

  joinChapter: (chapterId, selfId) => {
    const echo = initEcho()

    if (_channelName) {
      echo.leave(_channelName)
    }

    _channelName = `chapter.${chapterId}`

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(echo.join(_channelName) as any)
      .here((users: PresenceUser[]) => {
        set({ others: users.filter((u) => String(u.id) !== selfId) })
      })
      .joining((user: PresenceUser) => {
        set((s) => ({ others: [...s.others, user] }))
      })
      .leaving((user: PresenceUser) => {
        set((s) => ({ others: s.others.filter((u) => u.id !== user.id) }))
      })
      .listen('.verse.activity', (e: {
        verse_id: number
        user_id: number
        user_name: string
        action: 'noted' | 'highlighted'
      }) => {
        if (String(e.user_id) === selfId) return

        useActivityStore.getState().recordActivity(e.verse_id, {
          userId:   e.user_id,
          userName: e.user_name,
          action:   e.action,
          ts:       Date.now(),
        })

        const verb = e.action === 'noted' ? 'added a note' : 'highlighted a verse'
        useUIStore.getState().addToast(`${e.user_name} ${verb}`, 'info')
      })
  },

  leaveChapter: () => {
    if (_channelName) {
      getEcho()?.leave(_channelName)
      _channelName = null
    }
    set({ others: [] })
    useActivityStore.getState().clearAll()
  },
}))
```

- [ ] **Step 2: Verify TypeScript compiles**

```powershell
pnpm tsc --noEmit
```

Expected: no errors. The `as any` cast on `echo.join()` is necessary because laravel-echo's TypeScript types don't fully expose the fluent chain on `PresenceChannel`.

---

## Task 10: Frontend — Update PresenceAvatars + BreadcrumbBar

**Files:**
- Modify: `C:\Repos\tulia-study\src\components\realtime\PresenceAvatars.tsx`
- Modify: `C:\Repos\tulia-study\src\components\layout\BreadcrumbBar.tsx`

The existing `PresenceAvatars` component was built with the wrong `PresenceUser` type. Update it to use `{id, name, color}` — color is a 6-digit hex derived from the user's ID by channels.php. Wire it into `BreadcrumbBar` (right side) to show who else is reading.

- [ ] **Step 1: Replace PresenceAvatars.tsx**

Replace the full content of `C:\Repos\tulia-study\src\components\realtime\PresenceAvatars.tsx`:

```typescript
import type { PresenceUser } from '@/types'
import { cn } from '@/lib/cn'

interface PresenceAvatarsProps {
  users: PresenceUser[]
}

const MAX_VISIBLE = 3

export function PresenceAvatars({ users }: PresenceAvatarsProps) {
  if (users.length === 0) return null

  const visible  = users.slice(0, MAX_VISIBLE)
  const overflow = users.length - MAX_VISIBLE
  const label    = users.map((u) => u.name).join(', ') + ' reading this chapter'

  return (
    <div className="flex items-center -space-x-1" title={label} aria-label={label}>
      {visible.map((user) => (
        <span
          key={user.id}
          title={user.name}
          style={{
            backgroundColor: user.color + '33',
            color:           user.color,
            borderColor:     user.color + '66',
          }}
          className={cn(
            'w-5 h-5 rounded-full text-2xs font-medium flex items-center justify-center shrink-0',
            'ring-1 ring-bg-primary border select-none',
          )}
        >
          {user.name.charAt(0).toUpperCase()}
        </span>
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            'w-5 h-5 text-2xs bg-bg-tertiary text-text-muted rounded-full font-medium',
            'flex items-center justify-center shrink-0 ring-1 ring-bg-primary',
          )}
          title={`+${overflow} more`}
        >
          +{overflow}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Replace BreadcrumbBar.tsx**

Replace the full content of `C:\Repos\tulia-study\src\components\layout\BreadcrumbBar.tsx`:

```typescript
import { useVerseStore } from '@/lib/store/useVerseStore'
import { useUIStore } from '@/lib/store/useUIStore'
import { usePresenceStore } from '@/lib/store/usePresenceStore'
import { PresenceAvatars } from '@/components/realtime/PresenceAvatars'

export function BreadcrumbBar() {
  const books           = useVerseStore((s) => s.books)
  const selectedBook    = useVerseStore((s) => s.selectedBook)
  const selectedChapter = useVerseStore((s) => s.selectedChapter)
  const openCommandPalette = useUIStore((s) => s.openCommandPalette)
  const others          = usePresenceStore((s) => s.others)

  const book     = books.find((b) => b.id === selectedBook)
  const bookName = book?.name ?? selectedBook

  return (
    <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border-subtle bg-bg-secondary">
      <button
        onClick={openCommandPalette}
        className="text-xs text-text-muted hover:text-text-secondary transition-colors duration-150 cursor-pointer"
        title="Open command palette"
      >
        {bookName}
      </button>
      <span className="text-xs text-text-muted select-none">›</span>
      <span className="text-xs text-text-muted">{selectedChapter}</span>
      <div className="flex-1" />
      <PresenceAvatars users={others} />
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```powershell
pnpm tsc --noEmit
```

---

## Task 11: Frontend — Update VerseList to join channel + show friend activity

**Files:**
- Modify: `C:\Repos\tulia-study\src\components\verse\VerseList.tsx`

When a chapter is loaded and the user is logged in, `VerseList` joins the presence channel for that chapter. The existing `hasActivity` dot (accent/50 opacity) shows the user's own notes/highlights. A new pulsing dot (`animate-pulse`, full accent) overlaps it when a friend had activity on that verse within the last 30s.

- [ ] **Step 1: Add new imports to VerseList.tsx**

At the top of `C:\Repos\tulia-study\src\components\verse\VerseList.tsx`, after the existing imports, add:

```typescript
import { usePresenceStore } from '@/lib/store/usePresenceStore'
import { useActivityStore } from '@/lib/store/useActivityStore'
```

(`useAuthStore` is already imported at line 8.)

- [ ] **Step 2: Add selectors inside VerseList function body**

After the existing store selectors (after line ~99, before `const [burstId, setBurstId]`), add:

```typescript
  const chapterId       = useVerseStore((s) => s.chapterId)
  const joinChapter     = usePresenceStore((s) => s.joinChapter)
  const leaveChapter    = usePresenceStore((s) => s.leaveChapter)
  const activityByVerse = useActivityStore((s) => s.activityByVerse)
```

- [ ] **Step 3: Add useEffect to join/leave the presence channel**

After the existing `useEffect` that calls `loadHighlightsForChapter` (around line 104), add:

```typescript
  useEffect(() => {
    if (!user || !chapterId) return
    joinChapter(chapterId, user.id)
    return () => leaveChapter()
  }, [user?.id, chapterId])
```

- [ ] **Step 4: Update the VerseNum inner component to accept hasFriendActivity**

Find the `VerseNum` inner component (around line 185). Replace it:

```typescript
  function VerseNum({ n, isSelected, hasActivity, hasFriendActivity }: {
    n: number
    isSelected: boolean
    hasActivity: boolean
    hasFriendActivity: boolean
  }) {
    return (
      <span className="relative inline-block">
        <span className={cn(
          'font-sans text-[9px] font-bold align-super leading-none select-none mr-[2px]',
          isSelected ? 'text-accent' : 'text-accent/60',
        )}>
          {n}
        </span>
        {hasActivity && (
          <span className="absolute -top-px -right-[1px] w-[4px] h-[4px] rounded-full bg-accent/50" aria-hidden="true" />
        )}
        {hasFriendActivity && (
          <span className="absolute -top-px -right-[6px] w-[4px] h-[4px] rounded-full bg-accent animate-pulse" aria-hidden="true" />
        )}
      </span>
    )
  }
```

- [ ] **Step 5: Update flow mode rendering**

In the flow mode `verses.map(...)` (around line 250), after `const hasActivity = ...`, add:

```typescript
                  const hasFriendActivity = (activityByVerse[verse.apiId]?.length ?? 0) > 0
```

And update the `<VerseNum .../>` call to pass `hasFriendActivity`:

```typescript
                      <VerseNum n={verse.verse} isSelected={isSelected} hasActivity={hasActivity} hasFriendActivity={hasFriendActivity} />
```

- [ ] **Step 6: Update verse mode rendering**

In the verse mode `verses.map(...)` (around line 290), after `const hasActivity = ...`, add:

```typescript
                  const hasFriendActivity = (activityByVerse[verse.apiId]?.length ?? 0) > 0
```

In the verse mode, the activity dot is rendered inline (not via `VerseNum`). Find the existing dot:

```typescript
                        {hasActivity && (
                          <span className="absolute top-0 right-0 w-[4px] h-[4px] rounded-full bg-accent/50 translate-x-1 -translate-y-0.5" aria-hidden="true" />
                        )}
```

Add after it:

```typescript
                        {hasFriendActivity && (
                          <span className="absolute top-0 right-[-9px] w-[4px] h-[4px] rounded-full bg-accent animate-pulse translate-x-1 -translate-y-0.5" aria-hidden="true" />
                        )}
```

- [ ] **Step 7: Verify TypeScript compiles**

```powershell
pnpm tsc --noEmit
```

---

## Task 12: Frontend — Real-time friend notifications via private channel

**Files:**
- Modify: `C:\Repos\tulia-study\src\lib\store\useNotificationStore.ts`
- Modify: `C:\Repos\tulia-study\src\components\sidebar\Sidebar.tsx`

When a friend request is sent or accepted, the broadcast notification arrives on the private channel `App.Models.User.{userId}`. The frontend listens via Echo's `.notification()` helper which automatically handles `.Illuminate\Notifications\Events\BroadcastNotificationCreated`.

The `type` field in the broadcast payload is the full PHP class name (e.g., `App\\Notifications\\FriendRequestReceived`). On receipt: show a toast, increment badge, and trigger `load()` to sync the full list with the database.

- [ ] **Step 1: Add listenForPush and stopPush to useNotificationStore**

Open `C:\Repos\tulia-study\src\lib\store\useNotificationStore.ts`.

Add imports at the top:
```typescript
import { initEcho, getEcho } from '@/lib/echo'
import { useUIStore } from './useUIStore'
```

Add `_privateChannelName` module variable after `_pollInterval`:
```typescript
let _pollInterval: ReturnType<typeof setInterval> | null = null
let _privateChannelName: string | null = null
```

Add `listenForPush` and `stopPush` to the `NotificationStore` type:
```typescript
type NotificationStore = {
  notifications: AppNotification[]
  unreadCount: number
  load: () => Promise<void>
  startPolling: () => void
  stopPolling: () => void
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  listenForPush: (userId: string) => void
  stopPush: () => void
}
```

Add both actions to the `create` call, after `markAllRead`:

```typescript
  listenForPush: (userId) => {
    if (_privateChannelName) return

    _privateChannelName = `App.Models.User.${userId}`

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initEcho().private(_privateChannelName).notification((notif: any) => {
      const classType: string = notif.type ?? ''

      if (classType === 'App\\Notifications\\FriendRequestReceived') {
        const name: string = notif.requester_name ?? 'Someone'
        useUIStore.getState().addToast(`${name} sent you a friend request`, 'info')
        set((s) => ({ unreadCount: s.unreadCount + 1 }))
      } else if (classType === 'App\\Notifications\\FriendRequestAccepted') {
        const name: string = notif.acceptor_name ?? 'Someone'
        useUIStore.getState().addToast(`${name} accepted your friend request`, 'success')
        set((s) => ({ unreadCount: s.unreadCount + 1 }))
      }

      get().load()
    })
  },

  stopPush: () => {
    if (_privateChannelName) {
      getEcho()?.leave(_privateChannelName)
      _privateChannelName = null
    }
  },
```

- [ ] **Step 2: Wire listenForPush into Sidebar.tsx**

Open `C:\Repos\tulia-study\src\components\sidebar\Sidebar.tsx`.

Add import at the top:
```typescript
import { destroyEcho } from '@/lib/echo'
```

Add selectors inside `Sidebar` component (after the existing notification selectors):
```typescript
  const listenForPush = useNotificationStore(s => s.listenForPush)
  const stopPush      = useNotificationStore(s => s.stopPush)
```

Replace the existing `useEffect` (the one with `startPolling`/`stopPolling`):

```typescript
  useEffect(() => {
    if (!user) {
      stopPolling()
      stopPush()
      destroyEcho()
      return
    }
    startPolling()
    listenForPush(user.id)
    return () => {
      stopPolling()
      stopPush()
      destroyEcho()
    }
  }, [user, startPolling, stopPolling, listenForPush, stopPush])
```

- [ ] **Step 3: Verify TypeScript compiles**

```powershell
pnpm tsc --noEmit
```

Expected: no errors. The `any` casts in this task are necessary because Laravel Echo's TypeScript types for `.notification()` and the notification payload are typed as `any` upstream.

---

## End-to-End Verification

Run all three servers simultaneously to test the full flow:

- [ ] **Terminal 1 — Start Reverb WebSocket server**

```powershell
cd C:\Repos\verbum
php artisan reverb:start
```

Expected: `Starting server on 0.0.0.0:8080`

- [ ] **Terminal 2 — Start verbum API server**

```powershell
cd C:\Repos\verbum
php artisan serve
```

Expected: `Server running on [http://localhost:8000]`

- [ ] **Terminal 3 — Start tulia-study dev server**

```powershell
cd C:\Repos\tulia-study
pnpm dev
```

- [ ] **Test: Presence**

Open the app in two browser windows. Log in as different users (User A in window 1, User B in window 2). Navigate both to Genesis chapter 1. Window 1's BreadcrumbBar should show a colored avatar for User B within a few seconds, and vice versa.

- [ ] **Test: Verse activity**

While User B is on Genesis chapter 1, User A should right-click a verse and add a highlight (context menu → Yellow). Within 1-2 seconds User B should see: (1) a pulsing accent dot appear on that verse number, and (2) a toast "User A highlighted a verse".

- [ ] **Test: Friend request push**

Log out from User B's session. In User B's tab, navigate away so they're logged out. Send a friend request from User A to User B. Log User B back in. When User B logs in, the next time they open the app they should see the request badge. Then (while User B is logged in) have User A send a NEW friend request to a third user and accept it — User B should NOT get a toast. Send User B a request — User B SHOULD see the toast immediately (within 1-2 seconds, without waiting for the 30s poll).
