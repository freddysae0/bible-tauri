# Push Notifications Cross-Platform (Tulia)

Este plan asume los repos `~/Documents/Repos/bible` (Laravel) y `~/Documents/Repos/bible-tauri` (React + Tauri). Sigue las fases en orden; cada una es desplegable.

---

## Decisión de arquitectura

- **FCM (Firebase Cloud Messaging)** como hub único. FCM cubre web (vía VAPID/Web Push), Android nativamente, e iOS vía APNS bridge. Una sola tabla de tokens, un solo endpoint de envío.
- Real-time existente (Reverb/Echo) se queda para foreground in-app. El push se dispara cuando la sesión WebSocket no está conectada (cliente offline o app cerrada).
- **Tauri desktop (Win/Mac)** usa el FCM Web SDK desde el webview + `@tauri-apps/plugin-notification` para mostrar la notificación del SO cuando la app está abierta. Push con app cerrada en desktop no se soporta (documentar; fallback a email).
- **Tauri mobile (iOS/Android)** usa plugin nativo que registra token FCM/APNS y lo manda al mismo endpoint backend.
- Email como fallback cuando no hay suscripción push activa.

---

## Fase 0 — Setup Firebase

1. Crear proyecto Firebase `tulia-push` (separado de `tulia-bible` para aislar credenciales).
2. Habilitar Cloud Messaging.
3. Generar VAPID key (Web).
4. Generar service-account JSON (backend).
5. Apple Developer: APNS Auth Key (.p8) → subir a Firebase para iOS.
6. Android: descargar `google-services.json` (más adelante).

---

## Fase 1 — Backend (Laravel, bible repo)

### 1.1 Migración `push_subscriptions`

`database/migrations/2026_05_02_000000_create_push_subscriptions_table.php`:

| Columna | Tipo |
|---------|------|
| id | bigint auto-increment |
| user_id | FK → users, cascade |
| token | string(512), unique |
| platform | enum: web, android, ios, desktop |
| device_label | nullable string |
| last_used_at | timestamp |
| timestamps | |

Índices: (user_id), (token).

### 1.2 Modelo `App\Models\PushSubscription`

- `belongsTo(User)`. `$fillable = ['user_id', 'token', 'platform', 'device_label']`.
- En User: `hasMany(PushSubscription::class)`.

### 1.3 Migración `notification_preferences`

Una fila por usuario con boolean por evento. Default `true` para los críticos:

| Columna | Tipo |
|---------|------|
| user_id | PK, FK → users |
| chat_message | boolean |
| note_reply | boolean |
| note_like | boolean |
| friend_request | boolean |
| friend_accepted | boolean |
| activity_in_chapter | boolean |

### 1.4 Endpoints (`routes/api.php`, dentro del grupo `auth:sanctum`)

| Método | Ruta | Acción |
|--------|------|--------|
| POST | `/api/push/subscriptions` | Registrar/upsert token |
| DELETE | `/api/push/subscriptions/{token}` | Desregistrar |
| GET | `/api/push/subscriptions` | Listar dispositivos del user |
| GET | `/api/push/preferences` | Ver preferencias |
| PATCH | `/api/push/preferences` | Actualizar preferencias |

Controller: `App\Http\Controllers\Api\PushSubscriptionController` + `PushPreferenceController`. Validar `platform` con enum.

### 1.5 SDK FCM

```bash
composer require kreait/laravel-firebase
```

`.env`:
```
FIREBASE_CREDENTIALS=/var/www/storage/firebase-credentials.json
```

### 1.6 Servicio `App\Services\PushDispatcher`

API:
```php
PushDispatcher::send(User $user, string $event, array $payload): void
```

Responsabilidades:
- Mira `notification_preferences->{$event}` → si `false`, no hace nada.
- Mira `WebSocketPresence::isOnline($user)` (helper que consulta canal Reverb activo) → si está online, no manda push (Echo cubre); si está offline, sigue.
- Itera tokens del usuario; envía vía FCM con `data` + `notification` payload.
- En errores `404 NOT_FOUND` o `400 INVALID_ARGUMENT` borra el token muerto.
- Encola con `dispatch(new SendPushJob(...))->onQueue('push')`.

### 1.7 Disparadores existentes

Localizar y enganchar en estos puntos:

| Evento | Trigger | Receptor | Payload mínimo |
|--------|---------|----------|----------------|
| `chat_message` | `MessageController@store` después del broadcast | otros participantes | `{conversation_id, sender_name, body_preview}` |
| `note_reply` | `NoteController@store` cuando `parent_id != null` | dueño de la nota padre | `{verse_ref, replier_name}` |
| `note_like` | `NoteController@like` | dueño de la nota | `{verse_ref, liker_name}` |
| `friend_request` | `FriendshipController@store` | receptor | `{sender_name}` |
| `friend_accepted` | `FriendshipController@accept` | solicitante original | `{accepter_name}` |

Para cada uno, llamar `PushDispatcher::send($user, 'chat_message', [...])` después del DB commit.

### 1.8 Job `SendPushJob`

- `tries=3`, backoff exponencial.
- Maneja errores FCM y limpia tokens.

### 1.9 Worker

Añadir cola `push` al supervisor en contabo (`/etc/supervisor/conf.d/laravel-worker.conf`).

---

## Fase 2 — Web (foreground + background, bible-tauri)

### 2.1 Dependencias

```bash
pnpm add firebase
```

### 2.2 Config

`.env.local`:
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_PROJECT_ID=tulia-push
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_VAPID_PUBLIC_KEY=...
```

### 2.3 Service worker

`public/firebase-messaging-sw.js`:
- Importa Firebase compat scripts.
- Inicializa con la misma config.
- Maneja `messaging.onBackgroundMessage` → `self.registration.showNotification(title, { body, icon, data: {url} })`.
- `notificationclick` → abre `data.url` (deep link al chat o nota).

> Cuidado: ya existe un `public/sw.js` de otro propósito. No fusionarlos — Firebase requiere uno propio en la raíz con nombre exacto. Si hay conflicto de scope, registrar con `getToken(messaging, { vapidKey, serviceWorkerRegistration })`.

### 2.4 `src/lib/push.ts`

API pública:

```ts
isSupported(): boolean
getPermission(): NotificationPermission
requestAndRegister(): Promise<{ token: string } | null>
unregister(): Promise<void>
onForegroundMessage(cb): unsubscribe
detectPlatform(): 'web' | 'desktop' | 'android' | 'ios'
```

Flujo de `requestAndRegister`:
1. `Notification.requestPermission()`.
2. `getToken(messaging, { vapidKey, serviceWorkerRegistration })`.
3. `POST /api/push/subscriptions { token, platform, device_label: navigator.userAgent }`.
4. Guardar token en `localStorage` para detectar rotación.

`detectPlatform` usa `window.__TAURI_INTERNALS__` para reconocer Tauri y `navigator.userAgent` para móvil.

### 2.5 UI

- En `SettingsModal` (o crear panel Notifications): toggle maestro + toggle por evento (sincroniza con `/api/push/preferences`).
- No pedir permiso al cargar la app. Solo cuando el usuario hace click en "Habilitar notificaciones".
- Banner discreto en `ChatPanel` la primera vez que abre el chat: "Recibe avisos cuando te escriban → [Activar]".

### 2.6 Foreground

`onForegroundMessage` muestra toast in-app (no notificación de SO) usando `useUIStore.addToast`. Evita ruido cuando el user está mirando la app.

---

## Fase 3 — Tauri desktop (Windows + Mac)

### 3.1 Plugin OS

```bash
pnpm add @tauri-apps/plugin-notification
```

Permisos en `src-tauri/tauri.conf.json`:
```json
"plugins": { "notification": { "all": true } }
```

### 3.2 Lógica

- `detectPlatform()` devuelve `'desktop'` cuando `__TAURI_INTERNALS__` está y no es móvil.
- Backend trata desktop igual que web (mismo VAPID web token, FCM Web SDK funciona dentro del webview).
- Cuando llega push foreground (app abierta), llamar `sendNotification()` del plugin Tauri en vez del toast → así sale notificación del SO con sonido + iconos nativos.
- Cuando la app está cerrada en desktop: no hay push (limitación documentada). Email fallback cubre.

### 3.3 Build verification

```bash
pnpm tauri:build
```

Verificar que el webview registra token.

---

## Fase 4 — Tauri Android

### 4.1 Tauri 2 mobile init

```bash
pnpm tauri android init
```

### 4.2 Firebase Android

- Añadir `google-services.json` a `src-tauri/gen/android/app/`.
- `build.gradle`: aplicar `com.google.gms.google-services`.

### 4.3 Plugin push

Opciones:
- Usar plugin community `tauri-plugin-push-notifications` (Tauri 2 compatible) si tiene mantenimiento activo.
- Si no, escribir thin plugin Rust en `src-tauri/plugins/push/` que envuelve `FirebaseMessaging.getInstance().getToken()` y postea al webview vía `emit('push-token', token)`.

### 4.4 Bridge JS

`detectPlatform()` devuelve `'android'`. `requestAndRegister()` invoca el comando Tauri en vez de FCM Web SDK. Mismo POST al backend.

### 4.5 Notification handler

El plugin debe manejar:
- App foreground → emit evento al webview → mostrar toast.
- App background → mostrar notificación del sistema (lo hace FCM Android automáticamente con la notification payload).
- Tap → deep link via `intent.data` → router del frontend.

### 4.6 Test

- Emulador con Google Play Services.
- Token de prueba enviado vía `kreait` desde tinker.

---

## Fase 5 — Tauri iOS

Más burocracia, dejar último.

### 5.1 Apple Developer

- Cuenta paid ($99/año).
- App ID con Push Notifications capability.
- APNS Auth Key (.p8) → subir a Firebase.
- Provisioning profile.

### 5.2 Tauri iOS init

```bash
pnpm tauri ios init
```

### 5.3 Configuración Xcode

- Añadir `GoogleService-Info.plist`.
- Habilitar capability "Push Notifications" + "Background Modes → Remote notifications".
- En `AppDelegate.swift` que Tauri genera: registrar `UNUserNotificationCenter`, llamar `Messaging.messaging().token(completion:)`.

### 5.4 Plugin Rust

Mismo plugin que Android pero target iOS — la mayoría de plugins community ya cubren ambos.

### 5.5 Test

Solo en device físico (simulador no recibe push). TestFlight para QA.

---

## Fase 6 — Email fallback

- Job `SendUnreadDigestJob` que corre cada 30 min, busca notificaciones con `read_at IS NULL` cuyo `created_at > 30 min` y no se entregó push (o el user no tiene tokens), y manda email digest.
- Una sola plantilla en español/inglés según `users.locale`.

---

## Fase 7 — Observabilidad

- Tabla `push_logs` (event, user_id, token, status, error, created_at) o usar Sentry breadcrumb.
- Métricas: tasa de delivery por plataforma, tasa de tokens muertos.
- Endpoint admin `/admin/push/health` con conteo de subscribers por plataforma.

---

## Riesgos y notas

| Riesgo | Mitigación |
|--------|-----------|
| iOS Safari requiere PWA instalada para Web Push | Promover el binario nativo Tauri iOS antes de prometer push en Safari móvil |
| Tokens FCM rotan | Implementar `onTokenRefresh` listener y re-registrar |
| Spam de notificaciones | Server-side: rate-limit por user (ej. máx 1 push de chat por conversación cada 30 s, agrupando). Cliente: respetar `notification_preferences` |
| Service worker conflict (`sw.js` ya existente) | Usar nombre Firebase-canónico `firebase-messaging-sw.js` y registrar con scope explícito |
| Privacidad — payload visible en notificación | Para chats privados mostrar "Nuevo mensaje" sin contenido si el user activa "Hide preview" en preferences |

---

## Orden recomendado de entrega

1. **Fase 1 + 2** (backend + web) → 2–3 días, ya cubre el caso 80%.
2. **Fase 3** (Tauri desktop foreground OS notifications) → 0.5 día.
3. **Fase 6** (email fallback) → 1 día.
4. **Fase 4** (Android) → 2–3 días.
5. **Fase 5** (iOS) → 3–5 días + tiempo de Apple review.
6. **Fase 7** (obs) → ongoing.
