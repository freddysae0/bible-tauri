# Android push notifications — setup

Tauri Android no usa el FCM Web SDK (los webviews de Android no soportan
service workers de push). El binario integra el SDK nativo de Firebase
y escribe el token a disco; Rust lo expone vía el comando
`get_push_token` y el frontend lo registra contra `/api/push/subscriptions`
con `platform: "android"`.

## Estado del repositorio

Ya están commiteados:

- `src-tauri/gen/android/build.gradle.kts` — classpath de
  `com.google.gms:google-services`.
- `src-tauri/gen/android/app/build.gradle.kts` — `firebase-bom` +
  `firebase-messaging-ktx`. El plugin `google-services` se aplica
  condicionalmente sólo si existe `google-services.json` (así no rompe
  el build de devs sin Firebase configurado).
- `src-tauri/gen/android/app/src/main/AndroidManifest.xml` — permiso
  `POST_NOTIFICATIONS`, registro del `PushMessagingService`, y meta-data
  del canal por defecto.
- `src-tauri/gen/android/app/src/main/java/space/harbour/tulia_study/PushMessagingService.kt`
  — extiende `FirebaseMessagingService`, persiste el token en
  `Context.filesDir/fcm_token.txt`.
- `src-tauri/src/lib.rs` — comando `get_push_token` que lee ese archivo
  desde `app_data_dir()`.
- `src/lib/push.ts` — rama `requestAndRegisterAndroid()`.
- `src-tauri/capabilities/default.json` — permiso `notification:default`.

> ⚠️ `src-tauri/gen/android/` es output regenerable. El `.gitignore` de
> `src-tauri/` está tuneado para preservar sólo los archivos de arriba;
> si en algún momento corres `pnpm tauri android init`, Tauri puede
> sobrescribir Gradle/Manifest. Vuelve a aplicar los cambios mirando
> este commit.

## Lo que falta hacer manualmente

### 1. Crear app Android en Firebase Console

1. Abre el proyecto **`tulia-push`** en Firebase Console.
2. Settings → "Add app" → **Android**.
3. Package name: **`space.harbour.tulia_study`** (debe coincidir con
   `applicationId` del Gradle).
4. Nickname libre (ej. "Tulia Android").
5. (Opcional) SHA-1 del keystore — sólo necesario si usas Firebase Auth
   con Google Sign-In; para FCM no hace falta.
6. Descarga `google-services.json`.

### 2. Colocar el archivo

```bash
cp ~/Downloads/google-services.json src-tauri/gen/android/app/google-services.json
```

`.gitignore` ya excluye este archivo del repo. **No** lo commitees.

Para producción / CI: guarda el JSON en un secret manager y cópialo en
el step de build antes de `pnpm tauri android build`.

### 3. Compilar y testear

```bash
# Emulador con Google Play Services (no usar el "Google APIs" image —
# necesita "Google Play")
pnpm tauri android dev

# Build firmado
pnpm tauri android build
```

### 4. Verificar end-to-end

Con la app instalada en el dispositivo/emulador:

1. Loguearse en la app.
2. Abrir Settings → "Activar notificaciones" (o el banner del Chat).
3. Aceptar el permiso del SO.
4. En `adb logcat | grep TuliaPush` deberías ver
   `FCM token refreshed`.
5. En contabo: `php artisan tinker` →
   ```php
   App\Models\PushSubscription::where('platform', 'android')->latest()->first();
   ```
   Debe aparecer la fila nueva.
6. Disparar un push de prueba:
   ```php
   $t = App\Models\PushSubscription::where('platform','android')->first()->token;
   dispatch(new App\Jobs\SendPushJob($t, 'chat_message', [
       'sender_name'  => 'Test',
       'body_preview' => 'Hola desde el server',
       'url'          => '/?chat=1',
   ]))->onQueue('push');
   ```
   Debe llegar la notificación al sistema (con la app cerrada o en
   background).

## Cómo funciona internamente

```
┌────────────────┐  onNewToken  ┌──────────────────────────┐
│ FirebaseMsging │─────────────▶│ PushMessagingService.kt   │
│ (Google Play)  │              │  writes filesDir/         │
└────────────────┘              │   fcm_token.txt           │
                                └──────────────┬───────────┘
                                               │
                                       app_data_dir()
                                               │
                                ┌──────────────▼───────────┐
                                │ Rust: get_push_token cmd │
                                └──────────────┬───────────┘
                                               │ invoke
                                ┌──────────────▼───────────┐
                                │ requestAndRegisterAndroid│
                                │ (src/lib/push.ts)        │
                                └──────────────┬───────────┘
                                               │ POST
                                ┌──────────────▼───────────┐
                                │ /api/push/subscriptions  │
                                │ platform=android         │
                                └──────────────────────────┘
```

Cuando el server envía un push (vía `kreait/firebase-php`), FCM entrega
al dispositivo y:

- **App en background o cerrada**: el sistema renderiza la notificación
  automáticamente porque enviamos `notification` payload (no
  `data`-only).
- **App en foreground**: `PushMessagingService.onMessageReceived` se
  invoca; hoy sólo loggea. Si quieres mostrar un toast o highlight en
  la UI cuando la app está abierta, hay que añadir un canal de eventos
  Tauri (futura mejora).

## Limitaciones conocidas

- Sin `google-services.json` el APK compila pero el servicio nunca
  obtiene token → `get_push_token` siempre falla con `read … No such
  file or directory`. La UI muestra el toast `tokenFailed`.
- El emulador necesita imagen con **Google Play Services** (no la de
  AOSP "Google APIs only").
- Token rotation: FCM rota el token periódicamente. `onNewToken` lo
  sobrescribe en disco, pero no notifica al frontend que cambió. Si el
  usuario tiene la app abierta cuando rota, el backend seguirá teniendo
  el token viejo hasta el próximo reinicio. Para ser estrictos, habría
  que emitir un evento Tauri en `onNewToken` y re-postear al backend;
  pendiente.
- iOS aún no está implementado (Fase 5 del plan).
