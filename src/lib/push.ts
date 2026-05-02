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
  if (swRegistration?.active) return swRegistration;

  try {
    let reg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
    if (!reg) {
      reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    }
    // Wait until the SW is actually controlling the page; otherwise getToken
    // can race against an installing worker and silently return null.
    if (!reg.active) {
      await navigator.serviceWorker.ready;
      reg = (await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js')) ?? reg;
    }
    swRegistration = reg;
    return reg;
  } catch {
    return null;
  }
}

export type PushError =
  | 'unsupported'
  | 'ios-needs-pwa'
  | 'permission-denied'
  | 'permission-default'
  | 'sw-failed'
  | 'token-failed'
  | 'backend-failed';

export interface RegisterResult {
  ok: true;
  token: string;
}
export interface RegisterFailure {
  ok: false;
  reason: PushError;
}

export async function requestAndRegister(): Promise<RegisterResult | RegisterFailure> {
  if (!isSupported()) return { ok: false, reason: 'unsupported' };

  // iOS only allows Web Push from an installed PWA on iOS 16.4+
  const ua = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/.test(ua);
  const isStandalone =
    (window.matchMedia('(display-mode: standalone)').matches) ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (isIos && !isStandalone) {
    return { ok: false, reason: 'ios-needs-pwa' };
  }

  let perm: NotificationPermission;
  try {
    perm = await Notification.requestPermission();
  } catch {
    return { ok: false, reason: 'permission-denied' };
  }
  if (perm === 'denied')  return { ok: false, reason: 'permission-denied' };
  if (perm !== 'granted') return { ok: false, reason: 'permission-default' };

  const fcm = getFcmMessaging();
  if (!fcm) return { ok: false, reason: 'unsupported' };

  const swReg = await getSwRegistration();
  if (!swReg) return { ok: false, reason: 'sw-failed' };

  let token: string | null = null;
  try {
    token = await getToken(fcm, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });
  } catch {
    return { ok: false, reason: 'token-failed' };
  }
  if (!token) return { ok: false, reason: 'token-failed' };

  try {
    await api.post('/api/push/subscriptions', {
      token,
      platform: detectPlatform(),
      device_label: navigator.userAgent.slice(0, 255),
    });
  } catch {
    return { ok: false, reason: 'backend-failed' };
  }

  localStorage.setItem(TOKEN_STORAGE_KEY, token);
  return { ok: true, token };
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
