package study.tuliabible

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import java.io.File

/**
 * Bridge between FCM and the Tauri webview.
 *
 * Persists the FCM registration token under Context.filesDir so the Rust
 * side can read it via app_data_dir() and surface it to the frontend with
 * the `get_push_token` command.
 *
 * Background pushes (notification payload + app closed) are rendered by
 * FCM automatically; we only log foreground messages — the service worker
 * equivalent for in-app behavior runs in JS via the foreground listener.
 */
class PushMessagingService : FirebaseMessagingService() {
    companion object {
        private const val TAG = "TuliaPush"
        private const val TOKEN_FILE = "fcm_token.txt"
    }

    override fun onNewToken(token: String) {
        Log.d(TAG, "FCM token refreshed")
        try {
            File(applicationContext.filesDir, TOKEN_FILE).writeText(token)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to persist token", e)
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        Log.d(TAG, "Message received: data=${message.data} notification=${message.notification?.title}")
    }
}
