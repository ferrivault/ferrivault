import { create } from "zustand";
import {
  detectInitialLocale,
  getTrayLabelsForLocale,
  setAppLocale,
} from "../i18n/config";
import {
  apiCheckForUpdates,
  apiGetSettings,
  apiSyncTrayLocale,
  apiUpdateSettings,
  isTauriRuntime,
} from "../lib/tauri";
import {
  applyThemeToDocument,
  BUILTIN_THEMES,
  DEFAULT_THEME,
  parseAndValidateThemeJson,
} from "../lib/themes";
import type { AppSettings, UpdateCheckResult } from "../types/settings";
import type { FerriVaultTheme, ThemeSizing } from "../types/theme";

const LOCAL_SETTINGS_KEY = "ferrivault_settings";

function parseCustomThemes(rawJson?: string | null): FerriVaultTheme[] {
  if (!rawJson) return [];
  try {
    const arr = JSON.parse(rawJson) as unknown;
    if (!Array.isArray(arr)) return [];
    const valid: FerriVaultTheme[] = [];
    for (const item of arr) {
      try {
        valid.push(parseAndValidateThemeJson(JSON.stringify(item)));
      } catch {
        // Skip invalid entry
      }
    }
    return valid;
  } catch {
    return [];
  }
}

function findThemeById(
  themeId: string,
  customThemes: FerriVaultTheme[]
): FerriVaultTheme {
  return (
    BUILTIN_THEMES.find((t) => t.id === themeId) ??
    customThemes.find((t) => t.id === themeId) ??
    DEFAULT_THEME
  );
}

function loadPersistedSettings(): AppSettings {
  const defaults: AppSettings = {
    locale: detectInitialLocale(),
    clipboardClearSeconds: 30,
    autoLockMinutes: 15,
    closeToTray: true,
    showFavicons: true,
    activeThemeId: DEFAULT_THEME.id,
    customThemesJson: "[]",
    launchAtStartup: false,
    startMinimized: false,
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
  customThemes: FerriVaultTheme[];
  updateInfo: UpdateCheckResult | null;
  isCheckingUpdates: boolean;
  initializeSettings: () => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  changeLanguage: (code: string) => Promise<void>;
  selectTheme: (themeId: string) => Promise<void>;
  importCustomTheme: (rawJson: string) => Promise<FerriVaultTheme>;
  deleteCustomTheme: (themeId: string) => Promise<void>;
  updateActiveThemeSizing: (sizing: Partial<ThemeSizing>) => Promise<void>;
  checkForUpdates: (silent?: boolean) => Promise<UpdateCheckResult | null>;
}

const initialSettings = loadPersistedSettings();
const initialCustomThemes = parseCustomThemes(initialSettings.customThemesJson);

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...initialSettings,
  customThemes: initialCustomThemes,
  updateInfo: null,
  isCheckingUpdates: false,

  initializeSettings: async () => {
    let effective = loadPersistedSettings();

    if (isTauriRuntime()) {
      try {
        const remote = await apiGetSettings();
        // If localStorage has never been written, prefer disk-persisted settings
        if (!localStorage.getItem(LOCAL_SETTINGS_KEY)) {
          effective = { ...effective, ...remote };
        } else {
          await apiUpdateSettings(effective);
        }
      } catch {
        // Ignore if backend is still initializing
      }
    }

    const customThemes = parseCustomThemes(effective.customThemesJson);
    const activeTheme = findThemeById(effective.activeThemeId, customThemes);
    effective.activeThemeId = activeTheme.id;
    applyThemeToDocument(activeTheme);
    await setAppLocale(effective.locale);

    set({
      ...effective,
      customThemes,
    });

    if (isTauriRuntime()) {
      try {
        await apiSyncTrayLocale(getTrayLabelsForLocale(effective.locale));
      } catch {
        // Ignore
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
      activeThemeId: partial.activeThemeId ?? current.activeThemeId,
      customThemesJson: partial.customThemesJson ?? current.customThemesJson,
      launchAtStartup: partial.launchAtStartup ?? current.launchAtStartup,
      startMinimized: partial.startMinimized ?? current.startMinimized,
    };

    const customThemes =
      partial.customThemesJson !== undefined
        ? parseCustomThemes(next.customThemesJson)
        : current.customThemes;

    if (
      partial.activeThemeId !== undefined ||
      partial.customThemesJson !== undefined
    ) {
      const activeTheme = findThemeById(next.activeThemeId, customThemes);
      applyThemeToDocument(activeTheme);
    }

    if (partial.locale && partial.locale !== current.locale) {
      await setAppLocale(next.locale);
    }

    try {
      localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }

    set({
      ...next,
      customThemes,
    });

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

  selectTheme: async (themeId: string) => {
    await get().updateSettings({ activeThemeId: themeId });
  },

  importCustomTheme: async (rawJson: string) => {
    const imported = parseAndValidateThemeJson(rawJson);
    const currentCustom = get().customThemes.filter(
      (t) => t.id !== imported.id
    );
    const nextCustom = [...currentCustom, imported];
    await get().updateSettings({
      customThemesJson: JSON.stringify(nextCustom),
      activeThemeId: imported.id,
    });
    return imported;
  },

  deleteCustomTheme: async (themeId: string) => {
    const current = get();
    const nextCustom = current.customThemes.filter((t) => t.id !== themeId);
    const nextActiveId =
      current.activeThemeId === themeId
        ? DEFAULT_THEME.id
        : current.activeThemeId;
    await current.updateSettings({
      customThemesJson: JSON.stringify(nextCustom),
      activeThemeId: nextActiveId,
    });
  },

  updateActiveThemeSizing: async (sizingPartial: Partial<ThemeSizing>) => {
    const current = get();
    const active = findThemeById(current.activeThemeId, current.customThemes);
    const updatedSizing: ThemeSizing = {
      ...active.sizing,
      ...sizingPartial,
    };

    if (!active.isBuiltIn) {
      const updatedTheme: FerriVaultTheme = {
        ...active,
        sizing: updatedSizing,
      };
      const nextCustom = current.customThemes.map((t) =>
        t.id === active.id ? updatedTheme : t
      );
      await current.updateSettings({
        customThemesJson: JSON.stringify(nextCustom),
      });
    } else {
      // Apply live to document for built-in theme preview
      applyThemeToDocument(active, updatedSizing);
    }
  },

  checkForUpdates: async (silent = false) => {
    if (!isTauriRuntime()) return null;
    set({ isCheckingUpdates: true });
    try {
      const result = await apiCheckForUpdates();
      set({ updateInfo: result, isCheckingUpdates: false });
      return result;
    } catch (err) {
      set({ isCheckingUpdates: false });
      if (!silent) {
        throw err;
      }
      return null;
    }
  },
}));
