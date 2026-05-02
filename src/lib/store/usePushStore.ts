import { create } from 'zustand';
import {
  isSupported,
  getPermission,
  requestAndRegister,
  unregister,
  onForegroundMessage,
  listenForTokenRefresh,
  getStoredToken,
  detectPlatform,
} from '@/lib/push';
import { api } from '@/lib/api';
import { useUIStore } from './useUIStore';

export interface PushPreferences {
  chat_message: boolean;
  note_reply: boolean;
  note_like: boolean;
  friend_request: boolean;
  friend_accepted: boolean;
  activity_in_chapter: boolean;
}

interface PushState {
  isSupported: boolean;
  permission: NotificationPermission;
  token: string | null;
  isRequesting: boolean;
  preferences: PushPreferences;
  preferencesLoaded: boolean;

  checkSupport: () => void;
  requestPermission: () => Promise<void>;
  disablePush: () => Promise<void>;
  loadPreferences: () => Promise<void>;
  updatePreferences: (prefs: Partial<PushPreferences>) => Promise<void>;
}

export const usePushStore = create<PushState>((set, get) => ({
  isSupported: false,
  permission: 'default',
  token: getStoredToken(),
  isRequesting: false,
  preferences: {
    chat_message: true,
    note_reply: true,
    note_like: true,
    friend_request: true,
    friend_accepted: true,
    activity_in_chapter: true,
  },
  preferencesLoaded: false,

  checkSupport: () => {
    const supported = isSupported();
    set({
      isSupported: supported,
      permission: supported ? getPermission() : 'denied',
      token: getStoredToken(),
    });
  },

  requestPermission: async () => {
    set({ isRequesting: true });
    try {
      const result = await requestAndRegister();
      if (result) {
        set({
          token: result.token,
          permission: 'granted',
          isRequesting: false,
        });
      } else {
        set({ isRequesting: false });
      }
    } catch {
      set({ isRequesting: false });
    }
  },

  disablePush: async () => {
    await unregister();
    set({ token: null, permission: 'denied' });
  },

  loadPreferences: async () => {
    try {
      const prefs = await api.get<PushPreferences>('/api/push/preferences');
      set({ preferences: prefs, preferencesLoaded: true });
    } catch {
      set({ preferencesLoaded: true });
    }
  },

  updatePreferences: async (partial) => {
    const current = get().preferences;
    const updated = { ...current, ...partial };
    set({ preferences: updated });
    try {
      const prefs = await api.patch<PushPreferences>('/api/push/preferences', partial);
      set({ preferences: prefs });
    } catch {
      set({ preferences: current });
    }
  },
}));

export function initPushForegroundListener(): () => void {
  const platform = detectPlatform();

  const unsub = onForegroundMessage(async (payload) => {
    const title: string = payload.notification?.title || payload.data?.title || 'Tulia';
    const body: string = payload.notification?.body || payload.data?.body || '';

    if (platform === 'desktop') {
      try {
        const { sendNotification, isPermissionGranted, requestPermission } = await import(
          '@tauri-apps/plugin-notification'
        );

        let permitted = await isPermissionGranted();
        if (!permitted) {
          const result = await requestPermission();
          permitted = result === 'granted';
        }

        if (permitted) {
          sendNotification({ title, body });
        }
      } catch {
        useUIStore.getState().addToast(`${title}: ${body}`, 'info', { duration: 5000 });
      }
    } else {
      useUIStore.getState().addToast(`${title}: ${body}`, 'info', { duration: 5000 });
    }
  });

  listenForTokenRefresh();

  return unsub;
}
