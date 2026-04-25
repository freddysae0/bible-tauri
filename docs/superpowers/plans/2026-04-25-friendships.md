# Friendships Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add friend management (send/accept/decline/remove) across verbum API and tulia-study UI, with a notification badge and polling for unread friendship notifications.

**Architecture:** Four new API routes groups in verbum (friendships, user search, notifications) backed by a new JSON `FriendshipController`. On the frontend, two new Zustand stores (`useFriendStore`, `useNotificationStore`) feed a `FriendsPanel` that slides into the existing left-panel slot — triggered by a new "Friends" entry in the sidebar nav.

**Tech Stack:** Laravel 13 + Sanctum (verbum) · React 18 + Zustand 5 + Tailwind (tulia-study) · No test infrastructure in either repo (skip TDD steps)

---

## File Map

### verbum (C:\Repos\verbum)
| Action | File |
|---|---|
| **Create** | `app/Http/Controllers/Api/FriendshipController.php` |
| **Modify** | `app/Http/Controllers/Api/UserController.php` — add `search()` |
| **Create** | `app/Http/Controllers/Api/NotificationController.php` |
| **Modify** | `routes/api.php` — register all new routes |

### tulia-study (C:\Repos\tulia-study)
| Action | File |
|---|---|
| **Modify** | `src/types/index.ts` — add `Friend`, `FriendRequest`, `AppNotification`; expand `User` |
| **Create** | `src/lib/friendApi.ts` |
| **Create** | `src/lib/store/useFriendStore.ts` |
| **Create** | `src/lib/store/useNotificationStore.ts` |
| **Modify** | `src/lib/store/useUIStore.ts` — add `'friends'` to `activePanel` union |
| **Create** | `src/components/friends/FriendCard.tsx` |
| **Create** | `src/components/friends/FriendRequestCard.tsx` |
| **Create** | `src/components/friends/FriendSearch.tsx` |
| **Create** | `src/components/friends/FriendsPanel.tsx` |
| **Modify** | `src/components/sidebar/Sidebar.tsx` — Friends nav item + notification badge |
| **Modify** | `src/App.tsx` — wire `FriendsPanel` into `leftPanelContent` |

---

## Task 1: Backend — FriendshipController

**Files:**
- Create: `C:\Repos\verbum\app\Http\Controllers\Api\FriendshipController.php`

- [ ] **Step 1: Create the controller**

```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Friendship;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

class FriendshipController extends Controller
{
    /** Accepted friends of the authenticated user */
    public function friends(): JsonResponse
    {
        $friends = Auth::user()->friends()->select('id', 'name', 'email')->get();
        return response()->json($friends);
    }

    /** Pending requests received by the authenticated user */
    public function received(): JsonResponse
    {
        $requests = Friendship::where('friend_id', Auth::id())
            ->where('status', 'pending')
            ->with('user:id,name,email')
            ->latest()
            ->get();
        return response()->json($requests);
    }

    /** Pending requests sent by the authenticated user */
    public function sent(): JsonResponse
    {
        $requests = Friendship::where('user_id', Auth::id())
            ->where('status', 'pending')
            ->with('friend:id,name,email')
            ->latest()
            ->get();
        return response()->json($requests);
    }

    /** Send a friend request to $user */
    public function send(User $user): JsonResponse
    {
        if ($user->id === Auth::id()) {
            return response()->json(['message' => 'Cannot add yourself'], 422);
        }

        $exists = Friendship::where(function ($q) use ($user) {
            $q->where('user_id', Auth::id())->where('friend_id', $user->id);
        })->orWhere(function ($q) use ($user) {
            $q->where('user_id', $user->id)->where('friend_id', Auth::id());
        })->exists();

        if ($exists) {
            return response()->json(['message' => 'Friendship already exists'], 422);
        }

        $friendship = Friendship::create([
            'user_id'   => Auth::id(),
            'friend_id' => $user->id,
            'status'    => 'pending',
        ]);

        return response()->json($friendship->load('friend:id,name,email'), 201);
    }

    /** Accept a received request (only the recipient can accept) */
    public function accept(Friendship $friendship): JsonResponse
    {
        if ($friendship->friend_id !== Auth::id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $friendship->update(['status' => 'accepted']);

        return response()->json($friendship->load('user:id,name,email'));
    }

    /** Decline/cancel a request (either party can remove) */
    public function decline(Friendship $friendship): JsonResponse
    {
        if ($friendship->friend_id !== Auth::id() && $friendship->user_id !== Auth::id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $friendship->delete();

        return response()->json(null, 204);
    }

    /** Remove an accepted friendship (either direction) */
    public function remove(User $user): JsonResponse
    {
        Friendship::where(function ($q) use ($user) {
            $q->where('user_id', Auth::id())->where('friend_id', $user->id);
        })->orWhere(function ($q) use ($user) {
            $q->where('user_id', $user->id)->where('friend_id', Auth::id());
        })->where('status', 'accepted')->delete();

        return response()->json(null, 204);
    }
}
```

- [ ] **Step 2: Verify Friendship model has the `friend` relation**

Open `C:\Repos\verbum\app\Models\Friendship.php` and confirm there is a `friend()` BelongsTo relation (pointing to `friend_id`). If it does not exist, add:

```php
public function friend(): \Illuminate\Database\Eloquent\Relations\BelongsTo
{
    return $this->belongsTo(User::class, 'friend_id');
}
```

- [ ] **Step 3: Commit**

```bash
cd C:\Repos\verbum
git add app/Http/Controllers/Api/FriendshipController.php app/Models/Friendship.php
git commit -m "feat: add JSON FriendshipController"
```

---

## Task 2: Backend — User Search Endpoint

**Files:**
- Modify: `C:\Repos\verbum\app\Http\Controllers\Api\UserController.php`

- [ ] **Step 1: Add the `search` method**

Add this method to `UserController` (after `notes()`):

```php
public function search(\Illuminate\Http\Request $request): JsonResponse
{
    $q = trim((string) $request->query('q', ''));

    if (strlen($q) < 2) {
        return response()->json([]);
    }

    $users = \App\Models\User::where('id', '!=', \Illuminate\Support\Facades\Auth::id())
        ->where(function ($query) use ($q) {
            $query->where('name', 'like', "%{$q}%")
                  ->orWhere('email', 'like', "%{$q}%");
        })
        ->select('id', 'name', 'email')
        ->limit(10)
        ->get();

    return response()->json($users);
}
```

Also add `use Illuminate\Http\JsonResponse;` at the top of UserController if it is not already there.

- [ ] **Step 2: Commit**

```bash
cd C:\Repos\verbum
git add app/Http/Controllers/Api/UserController.php
git commit -m "feat: add user search endpoint"
```

---

## Task 3: Backend — NotificationController

**Files:**
- Create: `C:\Repos\verbum\app\Http\Controllers\Api\NotificationController.php`

- [ ] **Step 1: Create the controller**

```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

class NotificationController extends Controller
{
    public function index(): JsonResponse
    {
        $notifications = Auth::user()
            ->notifications()
            ->latest()
            ->take(30)
            ->get()
            ->map(fn($n) => [
                'id'         => $n->id,
                'type'       => $n->data['type'] ?? $n->type,
                'data'       => $n->data,
                'read_at'    => $n->read_at,
                'created_at' => $n->created_at,
            ]);

        return response()->json($notifications);
    }

    public function markRead(string $id): JsonResponse
    {
        $notification = Auth::user()->notifications()->findOrFail($id);
        $notification->markAsRead();
        return response()->json(['ok' => true]);
    }

    public function markAllRead(): JsonResponse
    {
        Auth::user()->unreadNotifications->markAsRead();
        return response()->json(['ok' => true]);
    }
}
```

- [ ] **Step 2: Commit**

```bash
cd C:\Repos\verbum
git add app/Http/Controllers/Api/NotificationController.php
git commit -m "feat: add NotificationController"
```

---

## Task 4: Backend — Register API Routes

**Files:**
- Modify: `C:\Repos\verbum\routes\api.php`

- [ ] **Step 1: Add imports and routes**

At the top of `routes/api.php`, add these use statements alongside the existing ones:

```php
use App\Http\Controllers\Api\FriendshipController;
use App\Http\Controllers\Api\NotificationController;
```

Inside the `auth:sanctum` middleware group (after the existing user aggregates block), add:

```php
    // Friends
    Route::get('/friends',                              [FriendshipController::class, 'friends']);
    Route::get('/friend-requests/received',             [FriendshipController::class, 'received']);
    Route::get('/friend-requests/sent',                 [FriendshipController::class, 'sent']);
    Route::post('/friends/{user}',                      [FriendshipController::class, 'send']);
    Route::patch('/friend-requests/{friendship}/accept',[FriendshipController::class, 'accept']);
    Route::delete('/friend-requests/{friendship}',      [FriendshipController::class, 'decline']);
    Route::delete('/friends/{user}',                    [FriendshipController::class, 'remove']);

    // Notifications
    Route::get('/notifications',                        [NotificationController::class, 'index']);
    Route::patch('/notifications/{id}/read',            [NotificationController::class, 'markRead']);
    Route::post('/notifications/read-all',              [NotificationController::class, 'markAllRead']);

    // User search
    Route::get('/users/search',                         [UserController::class, 'search']);
```

- [ ] **Step 2: Verify routes are registered**

```bash
cd C:\Repos\verbum
php artisan route:list --path=api/friends
php artisan route:list --path=api/notifications
php artisan route:list --path=api/users
```

Expected: each shows GET/POST/PATCH/DELETE routes with `auth:sanctum` middleware.

- [ ] **Step 3: Quick smoke test with curl (server must be running: `php artisan serve`)**

```bash
# Login first to get a token
curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"yourpassword"}' | python -m json.tool

# Then test friends list (replace TOKEN)
curl -s http://localhost:8000/api/friends \
  -H "Authorization: Bearer TOKEN" | python -m json.tool
```

Expected: `[]` (empty array for new user).

- [ ] **Step 4: Commit**

```bash
cd C:\Repos\verbum
git add routes/api.php
git commit -m "feat: register friendship, notification, user-search API routes"
```

---

## Task 5: Frontend — Types

**Files:**
- Modify: `C:\Repos\tulia-study\src\types\index.ts`

- [ ] **Step 1: Add new types and expand User**

Replace the current `User` type and append the new types at the end of `src/types/index.ts`:

```typescript
export type User = {
  id: string
  name: string
  email: string
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
```

- [ ] **Step 2: Commit**

```bash
cd C:\Repos\tulia-study
git add src/types/index.ts
git commit -m "feat: add Friend, FriendRequest, AppNotification types"
```

---

## Task 6: Frontend — friendApi.ts

**Files:**
- Create: `C:\Repos\tulia-study\src\lib\friendApi.ts`

- [ ] **Step 1: Create the API module**

```typescript
import { api } from './api'
import type { Friend, FriendRequest, AppNotification } from '../types'

export const friendApi = {
  friends:     ()                   => api.get<Friend[]>('/api/friends'),
  received:    ()                   => api.get<FriendRequest[]>('/api/friend-requests/received'),
  sent:        ()                   => api.get<FriendRequest[]>('/api/friend-requests/sent'),
  search:      (q: string)          => api.get<Friend[]>(`/api/users/search?q=${encodeURIComponent(q)}`),
  send:        (userId: number)     => api.post<FriendRequest>(`/api/friends/${userId}`, {}),
  accept:      (friendshipId: number) => api.patch<FriendRequest>(`/api/friend-requests/${friendshipId}/accept`, {}),
  decline:     (friendshipId: number) => api.delete<void>(`/api/friend-requests/${friendshipId}`),
  remove:      (userId: number)     => api.delete<void>(`/api/friends/${userId}`),
  notifications: ()                 => api.get<AppNotification[]>('/api/notifications'),
  markRead:    (id: string)         => api.patch<{ ok: boolean }>(`/api/notifications/${id}/read`, {}),
  markAllRead: ()                   => api.post<{ ok: boolean }>('/api/notifications/read-all', {}),
}
```

- [ ] **Step 2: Commit**

```bash
cd C:\Repos\tulia-study
git add src/lib/friendApi.ts
git commit -m "feat: add friendApi"
```

---

## Task 7: Frontend — useFriendStore

**Files:**
- Create: `C:\Repos\tulia-study\src\lib\store\useFriendStore.ts`

- [ ] **Step 1: Create the store**

```typescript
import { create } from 'zustand'
import { friendApi } from '../friendApi'
import type { Friend, FriendRequest } from '../../types'

type FriendStore = {
  friends: Friend[]
  received: FriendRequest[]
  sent: FriendRequest[]
  searchResults: Friend[]
  isSearching: boolean

  load: () => Promise<void>
  searchUsers: (q: string) => Promise<void>
  clearSearch: () => void
  sendRequest: (userId: number) => Promise<void>
  acceptRequest: (friendshipId: number) => Promise<void>
  declineRequest: (friendshipId: number) => Promise<void>
  removeFriend: (userId: number) => Promise<void>
}

export const useFriendStore = create<FriendStore>((set, get) => ({
  friends: [],
  received: [],
  sent: [],
  searchResults: [],
  isSearching: false,

  load: async () => {
    const [friends, received, sent] = await Promise.all([
      friendApi.friends(),
      friendApi.received(),
      friendApi.sent(),
    ])
    set({ friends, received, sent })
  },

  searchUsers: async (q) => {
    if (q.trim().length < 2) {
      set({ searchResults: [] })
      return
    }
    set({ isSearching: true })
    try {
      const results = await friendApi.search(q)
      set({ searchResults: results })
    } finally {
      set({ isSearching: false })
    }
  },

  clearSearch: () => set({ searchResults: [] }),

  sendRequest: async (userId) => {
    const req = await friendApi.send(userId)
    set((s) => ({ sent: [...s.sent, req] }))
  },

  acceptRequest: async (friendshipId) => {
    await friendApi.accept(friendshipId)
    const accepted = get().received.find((r) => r.id === friendshipId)
    set((s) => ({
      received: s.received.filter((r) => r.id !== friendshipId),
      friends: accepted?.user
        ? [...s.friends, accepted.user]
        : s.friends,
    }))
  },

  declineRequest: async (friendshipId) => {
    await friendApi.decline(friendshipId)
    set((s) => ({
      received: s.received.filter((r) => r.id !== friendshipId),
      sent: s.sent.filter((r) => r.id !== friendshipId),
    }))
  },

  removeFriend: async (userId) => {
    await friendApi.remove(userId)
    set((s) => ({ friends: s.friends.filter((f) => f.id !== userId) }))
  },
}))
```

- [ ] **Step 2: Commit**

```bash
cd C:\Repos\tulia-study
git add src/lib/store/useFriendStore.ts
git commit -m "feat: add useFriendStore"
```

---

## Task 8: Frontend — useNotificationStore

**Files:**
- Create: `C:\Repos\tulia-study\src\lib\store\useNotificationStore.ts`

- [ ] **Step 1: Create the store with 30-second polling**

```typescript
import { create } from 'zustand'
import { friendApi } from '../friendApi'
import type { AppNotification } from '../../types'

type NotificationStore = {
  notifications: AppNotification[]
  unreadCount: number
  pollInterval: ReturnType<typeof setInterval> | null

  load: () => Promise<void>
  startPolling: () => void
  stopPolling: () => void
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  pollInterval: null,

  load: async () => {
    try {
      const notifications = await friendApi.notifications()
      const unreadCount = notifications.filter((n) => n.read_at === null).length
      set({ notifications, unreadCount })
    } catch {
      // silently fail — user may not be logged in
    }
  },

  startPolling: () => {
    if (get().pollInterval) return
    get().load()
    const pollInterval = setInterval(() => get().load(), 30_000)
    set({ pollInterval })
  },

  stopPolling: () => {
    const { pollInterval } = get()
    if (pollInterval) clearInterval(pollInterval)
    set({ pollInterval: null })
  },

  markRead: async (id) => {
    await friendApi.markRead(id)
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, read_at: new Date().toISOString() } : n,
      ),
      unreadCount: Math.max(0, s.unreadCount - 1),
    }))
  },

  markAllRead: async () => {
    await friendApi.markAllRead()
    set((s) => ({
      notifications: s.notifications.map((n) => ({
        ...n,
        read_at: n.read_at ?? new Date().toISOString(),
      })),
      unreadCount: 0,
    }))
  },
}))
```

- [ ] **Step 2: Commit**

```bash
cd C:\Repos\tulia-study
git add src/lib/store/useNotificationStore.ts
git commit -m "feat: add useNotificationStore with 30s polling"
```

---

## Task 9: Frontend — Expand useUIStore

**Files:**
- Modify: `C:\Repos\tulia-study\src\lib\store\useUIStore.ts`

- [ ] **Step 1: Add `'friends'` to the `activePanel` union**

Change the `activePanel` type and `openPanel` signature in two places. The full updated type block (replace the existing one):

```typescript
type UIStore = {
  commandPaletteOpen: boolean
  shortcutsPanelOpen: boolean
  settingsOpen: boolean
  toasts: Toast[]
  activePanel: 'favorites' | 'my-notes' | 'friends' | null
  fontSize: FontSize
  theme: Theme
  openCommandPalette: () => void
  closeCommandPalette: () => void
  toggleShortcutsPanel: () => void
  openSettings: () => void
  closeSettings: () => void
  addToast: (message: string, type?: Toast['type']) => void
  removeToast: (id: string) => void
  openPanel: (panel: 'favorites' | 'my-notes' | 'friends') => void
  closePanel: () => void
  setFontSize: (size: FontSize) => void
  setTheme: (t: Theme) => void
}
```

- [ ] **Step 2: Commit**

```bash
cd C:\Repos\tulia-study
git add src/lib/store/useUIStore.ts
git commit -m "feat: add friends panel to UIStore activePanel"
```

---

## Task 10: Frontend — FriendCard + FriendRequestCard

**Files:**
- Create: `C:\Repos\tulia-study\src\components\friends\FriendCard.tsx`
- Create: `C:\Repos\tulia-study\src\components\friends\FriendRequestCard.tsx`

- [ ] **Step 1: Create FriendCard**

```tsx
import type { Friend } from '@/types'

interface FriendCardProps {
  friend: Friend
  onRemove: (userId: number) => void
}

export function FriendCard({ friend, onRemove }: FriendCardProps) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded hover:bg-bg-tertiary group transition-colors">
      <div className="w-7 h-7 rounded-full bg-bg-tertiary border border-border-subtle flex items-center justify-center shrink-0 text-2xs text-text-secondary font-medium select-none">
        {friend.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-text-primary truncate">{friend.name}</p>
        <p className="text-2xs text-text-muted truncate">{friend.email}</p>
      </div>
      <button
        onClick={() => onRemove(friend.id)}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-red-400 p-1 rounded"
        title="Remove friend"
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
          <path d="M3 8h10" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Create FriendRequestCard**

```tsx
import type { FriendRequest } from '@/types'

interface FriendRequestCardProps {
  request: FriendRequest
  onAccept: (id: number) => void
  onDecline: (id: number) => void
}

export function FriendRequestCard({ request, onAccept, onDecline }: FriendRequestCardProps) {
  const person = request.user ?? request.friend
  if (!person) return null

  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded bg-bg-secondary border border-border-subtle">
      <div className="w-7 h-7 rounded-full bg-bg-tertiary border border-border-subtle flex items-center justify-center shrink-0 text-2xs text-text-secondary font-medium select-none">
        {person.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-text-primary truncate">{person.name}</p>
        <p className="text-2xs text-text-muted truncate">{person.email}</p>
      </div>
      {/* Only show accept/decline for received requests */}
      {request.user && (
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => onAccept(request.id)}
            className="text-2xs px-2 py-0.5 rounded bg-accent text-bg-primary hover:opacity-80 transition-opacity font-medium"
          >
            Accept
          </button>
          <button
            onClick={() => onDecline(request.id)}
            className="text-2xs px-2 py-0.5 rounded border border-border-subtle text-text-muted hover:text-text-primary transition-colors"
          >
            Decline
          </button>
        </div>
      )}
      {/* Sent request — just show pending state */}
      {request.friend && (
        <span className="text-2xs text-text-muted italic shrink-0">pending</span>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
cd C:\Repos\tulia-study
git add src/components/friends/FriendCard.tsx src/components/friends/FriendRequestCard.tsx
git commit -m "feat: add FriendCard and FriendRequestCard components"
```

---

## Task 11: Frontend — FriendSearch

**Files:**
- Create: `C:\Repos\tulia-study\src\components\friends\FriendSearch.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState, useEffect, useRef } from 'react'
import { useFriendStore } from '@/lib/store/useFriendStore'

export function FriendSearch() {
  const [query, setQuery] = useState('')
  const searchUsers  = useFriendStore(s => s.searchUsers)
  const clearSearch  = useFriendStore(s => s.clearSearch)
  const results      = useFriendStore(s => s.searchResults)
  const isSearching  = useFriendStore(s => s.isSearching)
  const sendRequest  = useFriendStore(s => s.sendRequest)
  const sent         = useFriendStore(s => s.sent)
  const friends      = useFriendStore(s => s.friends)
  const debounce     = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => {
      if (query.trim().length >= 2) {
        searchUsers(query)
      } else {
        clearSearch()
      }
    }, 300)
    return () => { if (debounce.current) clearTimeout(debounce.current) }
  }, [query])

  const sentIds    = new Set(sent.map((r) => r.friend_id))
  const friendIds  = new Set(friends.map((f) => f.id))

  const handleSend = async (userId: number) => {
    await sendRequest(userId)
  }

  return (
    <div className="px-3 pb-3">
      <div className="relative">
        <svg
          viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted pointer-events-none"
        >
          <circle cx="6.5" cy="6.5" r="4" />
          <path d="M11 11l2.5 2.5" strokeLinecap="round" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full bg-bg-tertiary border border-border-subtle rounded px-3 py-1.5 pl-7 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      {isSearching && (
        <p className="text-2xs text-text-muted mt-2 px-1">Searching…</p>
      )}

      {results.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {results.map((user) => {
            const isFriend  = friendIds.has(user.id)
            const isPending = sentIds.has(user.id)
            return (
              <div key={user.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-bg-tertiary transition-colors">
                <div className="w-6 h-6 rounded-full bg-bg-tertiary border border-border-subtle flex items-center justify-center text-2xs text-text-secondary font-medium shrink-0 select-none">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-text-primary truncate">{user.name}</p>
                  <p className="text-2xs text-text-muted truncate">{user.email}</p>
                </div>
                {isFriend ? (
                  <span className="text-2xs text-text-muted shrink-0">friends</span>
                ) : isPending ? (
                  <span className="text-2xs text-text-muted italic shrink-0">sent</span>
                ) : (
                  <button
                    onClick={() => handleSend(user.id)}
                    className="text-2xs px-2 py-0.5 rounded border border-border-subtle text-text-secondary hover:text-accent hover:border-accent transition-colors shrink-0"
                  >
                    Add
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {query.trim().length >= 2 && !isSearching && results.length === 0 && (
        <p className="text-2xs text-text-muted mt-2 px-1">No users found</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd C:\Repos\tulia-study
git add src/components/friends/FriendSearch.tsx
git commit -m "feat: add FriendSearch component"
```

---

## Task 12: Frontend — FriendsPanel

**Files:**
- Create: `C:\Repos\tulia-study\src\components\friends\FriendsPanel.tsx`

- [ ] **Step 1: Create the panel**

```tsx
import { useEffect } from 'react'
import { useFriendStore } from '@/lib/store/useFriendStore'
import { useUIStore } from '@/lib/store/useUIStore'
import { FriendCard } from './FriendCard'
import { FriendRequestCard } from './FriendRequestCard'
import { FriendSearch } from './FriendSearch'

export function FriendsPanel() {
  const friends       = useFriendStore(s => s.friends)
  const received      = useFriendStore(s => s.received)
  const sent          = useFriendStore(s => s.sent)
  const load          = useFriendStore(s => s.load)
  const acceptRequest = useFriendStore(s => s.acceptRequest)
  const declineRequest = useFriendStore(s => s.declineRequest)
  const removeFriend  = useFriendStore(s => s.removeFriend)
  const closePanel    = useUIStore(s => s.closePanel)
  const addToast      = useUIStore(s => s.addToast)

  useEffect(() => { load() }, [])

  const handleAccept = async (id: number) => {
    await acceptRequest(id)
    addToast('Friend request accepted', 'success')
  }

  const handleDecline = async (id: number) => {
    await declineRequest(id)
  }

  const handleRemove = async (userId: number) => {
    await removeFriend(userId)
    addToast('Friend removed', 'info')
  }

  return (
    <div className="w-panel h-full bg-bg-primary border-r border-border-subtle flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle shrink-0">
        <span className="text-sm font-medium text-text-primary">Friends</span>
        <button
          onClick={closePanel}
          className="text-text-muted hover:text-text-primary transition-colors"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
            <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Search */}
        <div className="pt-3 pb-2">
          <p className="text-2xs uppercase tracking-wider text-text-muted px-4 pb-2 select-none">Add people</p>
          <FriendSearch />
        </div>

        {/* Received requests */}
        {received.length > 0 && (
          <div className="border-t border-border-subtle pt-3 pb-2">
            <p className="text-2xs uppercase tracking-wider text-text-muted px-4 pb-2 select-none">
              Requests ({received.length})
            </p>
            <div className="flex flex-col gap-1 px-2">
              {received.map((req) => (
                <FriendRequestCard
                  key={req.id}
                  request={req}
                  onAccept={handleAccept}
                  onDecline={handleDecline}
                />
              ))}
            </div>
          </div>
        )}

        {/* Sent requests */}
        {sent.length > 0 && (
          <div className="border-t border-border-subtle pt-3 pb-2">
            <p className="text-2xs uppercase tracking-wider text-text-muted px-4 pb-2 select-none">Sent</p>
            <div className="flex flex-col gap-1 px-2">
              {sent.map((req) => (
                <FriendRequestCard
                  key={req.id}
                  request={req}
                  onAccept={handleAccept}
                  onDecline={handleDecline}
                />
              ))}
            </div>
          </div>
        )}

        {/* Friends list */}
        <div className="border-t border-border-subtle pt-3 pb-4">
          <p className="text-2xs uppercase tracking-wider text-text-muted px-4 pb-2 select-none">
            Friends {friends.length > 0 && `(${friends.length})`}
          </p>
          {friends.length === 0 ? (
            <p className="text-xs text-text-muted px-4">No friends yet. Search above to add people.</p>
          ) : (
            <div className="flex flex-col gap-0.5 px-2">
              {friends.map((friend) => (
                <FriendCard key={friend.id} friend={friend} onRemove={handleRemove} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd C:\Repos\tulia-study
git add src/components/friends/FriendsPanel.tsx
git commit -m "feat: add FriendsPanel"
```

---

## Task 13: Frontend — Sidebar + App Wiring

**Files:**
- Modify: `C:\Repos\tulia-study\src\components\sidebar\Sidebar.tsx`
- Modify: `C:\Repos\tulia-study\src\App.tsx`

- [ ] **Step 1: Add Friends nav item and notification badge to Sidebar**

Add these imports at the top of `Sidebar.tsx` (after existing imports):

```tsx
import { useNotificationStore } from '@/lib/store/useNotificationStore'
import { useAuthStore } from '@/lib/store/useAuthStore'
```

Add the `PeopleIcon` function alongside the existing icon functions:

```tsx
function PeopleIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
      <circle cx="6" cy="5" r="2.5" />
      <path d="M1 13c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5" strokeLinecap="round" />
      <circle cx="12" cy="5" r="1.5" />
      <path d="M12 9.5c1.5.2 3 1.2 3 3.5" strokeLinecap="round" />
    </svg>
  )
}
```

In the `Sidebar` function body, add these lines after the existing store hooks:

```tsx
const startPolling  = useNotificationStore(s => s.startPolling)
const stopPolling   = useNotificationStore(s => s.stopPolling)
const unreadCount   = useNotificationStore(s => s.unreadCount)
const authUser      = useAuthStore(s => s.user)

useEffect(() => {
  if (authUser) {
    startPolling()
  } else {
    stopPolling()
  }
  return () => stopPolling()
}, [authUser])
```

> This requires adding `import { useEffect } from 'react'` — check if it is already imported; if `useState` is already imported from `'react'`, add `useEffect` to the same import.

Replace the Friends `NavItem` (currently the "Activity" one, or add a new one) in the personal nav section:

```tsx
<div className="shrink-0 border-t border-border-subtle pt-1 pb-1 px-2 flex flex-col gap-0.5">
  <NavItem icon={<StarIcon />}    label="Favorites"  onClick={() => openPanel('favorites')} />
  <NavItem icon={<NoteIcon />}    label="My Notes"   onClick={() => openPanel('my-notes')} />
  <div className="relative">
    <NavItem icon={<PeopleIcon />} label="Friends" onClick={() => openPanel('friends')} />
    {unreadCount > 0 && (
      <span className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[16px] h-4 px-1 rounded-full bg-accent text-bg-primary text-2xs font-medium flex items-center justify-center pointer-events-none">
        {unreadCount > 9 ? '9+' : unreadCount}
      </span>
    )}
  </div>
</div>
```

- [ ] **Step 2: Wire FriendsPanel into App.tsx**

Add the import:

```tsx
import { FriendsPanel } from '@/components/friends/FriendsPanel'
```

Update the `leftPanelContent` expression:

```tsx
const leftPanelContent = activePanel === 'favorites' ? <FavoritesPanel />
  : activePanel === 'my-notes' ? <MyNotesPanel />
  : activePanel === 'friends' ? <FriendsPanel />
  : null
```

- [ ] **Step 3: Commit**

```bash
cd C:\Repos\tulia-study
git add src/components/sidebar/Sidebar.tsx src/App.tsx
git commit -m "feat: wire FriendsPanel into sidebar and app layout"
```

---

## Task 14: Manual Verification

- [ ] Start verbum: `php artisan serve` in `C:\Repos\verbum` (PowerShell)
- [ ] Start tulia-study: `pnpm tauri:dev` in `C:\Repos\tulia-study` (PowerShell)
- [ ] Sign in as user A
- [ ] Click "Friends" in the sidebar — FriendsPanel slides in
- [ ] Search for user B by name — results appear
- [ ] Click "Add" — request sends, button changes to "sent"
- [ ] Sign in as user B (separate session) — notification badge appears
- [ ] Open Friends panel as user B — request appears in "Requests" section
- [ ] Click Accept — user A appears in friends list; badge clears
- [ ] As user A — user B now appears in friends list
- [ ] Click the remove (minus) icon on a friend — friend disappears
- [ ] Decline a request — request disappears from both sides
