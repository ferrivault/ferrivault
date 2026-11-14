import { create } from "zustand";
import {
  detectInitialLocale,
  getTrayLabelsForLocale,
  setAppLocale,
} from "../i18n/config";
import {
  apiGetSettings,
  apiSyncTrayLocale,
  apiUpdateSettings,
  isTauriRuntime,
} from "../lib/tauri";
import type { AppSettings } from "../types/settings";

const LOCAL_SETTINGS_KEY = "rustwarden_settings";

function loadPersistedSettings(): AppSettings {
  const defaults: AppSettings = {
    locale: detectInitialLocale(),
    clipboardClearSeconds: 30,
    autoLockMinutes: 15,
    closeToTray: true,
    showFavicons: true,
  };
  try {
    const raw = localStorage.getItem(LOCAL_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      return { ...defaults, ...parsed };
    }
  } catch {
    // Ignore storage errors
  }
  return defaults;
}

interface SettingsState extends AppSettings {
  initializeSettings: () => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  changeLanguage: (code: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...loadPersistedSettings(),

  initializeSettings: async () => {
    const local = loadPersistedSettings();
    await setAppLocale(local.locale);
    set(local);

    if (isTauriRuntime()) {
      try {
        await apiUpdateSettings(local);
        await apiSyncTrayLocale(getTrayLabelsForLocale(local.locale));
      } catch {
        // Fallback silently if backend is still initializing
        try {
          const remote = await apiGetSettings();
          set(remote);
        } catch {
          // Ignore
        }
      }
    }
  },

  updateSettings: async (partial) => {
    const current = get();
    const next: AppSettings = {
      locale: partial.locale ?? current.locale,
      clipboardClearSeconds:
        partial.clipboardClearSeconds ?? current.clipboardClearSeconds,
      autoLockMinutes: partial.autoLockMinutes ?? current.autoLockMinutes,
      closeToTray: partial.closeToTray ?? current.closeToTray,
      showFavicons: partial.showFavicons ?? current.showFavicons,
    };

    if (partial.locale && partial.locale !== current.locale) {
      await setAppLocale(next.locale);
    }

    try {
      localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }

    set(next);

    if (isTauriRuntime()) {
      try {
        await apiUpdateSettings(next);
        if (partial.locale) {
          await apiSyncTrayLocale(getTrayLabelsForLocale(next.locale));
        }
      } catch {
        // Ignore IPC errors outside Tauri
      }
    }
  },

  changeLanguage: async (code: string) => {
    await get().updateSettings({ locale: code });
  },
}));
