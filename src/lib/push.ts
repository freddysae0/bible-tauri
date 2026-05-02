import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getMessaging,
  getToken,
  onMessage,
  deleteToken,
  type Messaging,
} from 'firebase/messaging';
import { api } from './api';

const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'tulia-push',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_PUBLIC_KEY || '';

const TOKEN_STORAGE_KEY = 'verbum_fcm_token';

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;
let swRegistration: ServiceWorkerRegistration | null = null;

function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = initializeApp(FIREBASE_CONFIG, 'tulia-push-app');
  }
  return app;
}

function getFcmMessaging(): Messaging | null {
  if (!messaging) {
    try {
      const fapp = getFirebaseApp();
      messaging = getMessaging(fapp);
    } catch {
      return null;
    }
  }
  return messaging;
}

export type PushPlatform = 'web' | 'desktop' | 'android' | 'ios';

export function detectPlatform(): PushPlatform {
  if (typeof window === 'undefined') return 'web';

  const hasTauri = !!(window as any).__TAURI_INTERNALS__;

  if (hasTauri) {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('android')) return 'android';
    if (ua.includes('iphone') || ua.includes('ipad')) return 'ios';
    return 'desktop';
  }

  return 'web';
}

export function isSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

export function getPermission(): NotificationPermission {
  if (!isSupported()) return 'denied';
  return Notification.permission;
}

async function getSwRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (swRegistration) return swRegistration;

  try {
    swRegistration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
    if (!swRegistration) {
      swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    }
    return swRegistration;
  } catch {
    return null;
  }
}

export async function requestAndRegister(): Promise<{ token: string } | null> {
  if (!isSupported()) return null;

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return null;

  const fcm = getFcmMessaging();
  if (!fcm) return null;

  try {
    const swReg = await getSwRegistration();
    if (!swReg) return null;

    const token = await getToken(fcm, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });

    if (!token) return null;

    const platform = detectPlatform();

    await api.post('/api/push/subscriptions', {
      token,
      platform,
      device_label: navigator.userAgent.slice(0, 255),
    });

    localStorage.setItem(TOKEN_STORAGE_KEY, token);

    return { token };
  } catch {
    return null;
  }
}

export async function unregister(): Promise<void> {
  const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(TOKEN_STORAGE_KEY);

  if (storedToken) {
    try {
      await api.delete(`/api/push/subscriptions/${encodeURIComponent(storedToken)}`);
    } catch { /* backend cleanup best-effort */ }
  }

  const fcm = getFcmMessaging();
  if (fcm) {
    try {
      await deleteToken(fcm);
    } catch { /* ignore */ }
  }
}

export type MessageCallback = (payload: any) => void;

export function onForegroundMessage(cb: MessageCallback): () => void {
  const fcm = getFcmMessaging();
  if (!fcm) return () => {};

  const unsubscribe = onMessage(fcm, cb);
  return unsubscribe;
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

let tokenRefreshUnsub: (() => void) | null = null;

export function listenForTokenRefresh(): void {
  if (tokenRefreshUnsub) return;

  const sw = async () => {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'activated') {
          requestAndRegister();
        }
      });
    });
  };

  sw();
}
