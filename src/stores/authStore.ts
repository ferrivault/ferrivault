import { create } from "zustand";
import {
  apiGetAuthStatus,
  apiLockVault,
  apiLogin,
  apiLogout,
  apiUnlockVault,
  isTauriRuntime,
} from "../lib/tauri";
import type { LoginPayload, ServerRegion } from "../types/auth";
import type { VaultSnapshot } from "../types/vault";

const SERVER_PREF_KEY = "rustwarden_server_prefs";

interface SavedServerPrefs {
  email: string;
  region: ServerRegion;
  customServerUrl: string;
}

function loadServerPrefs(): SavedServerPrefs {
  try {
    const raw = localStorage.getItem(SERVER_PREF_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SavedServerPrefs>;
      return {
        email: parsed.email ?? "",
        region: parsed.region ?? "officialUs",
        customServerUrl: parsed.customServerUrl ?? "",
      };
    }
  } catch {
    // Ignore storage errors
  }
  return { email: "", region: "officialUs", customServerUrl: "" };
}

interface AuthState {
  isLoggedIn: boolean;
  isLocked: boolean;
  isLoading: boolean;
  email: string;
  serverUrl: string;
  region: ServerRegion;
  customServerUrl: string;
  checkStatus: () => Promise<void>;
  login: (payload: LoginPayload) => Promise<VaultSnapshot>;
  unlock: (masterPassword: string) => Promise<VaultSnapshot>;
  lock: () => Promise<void>;
  logout: () => Promise<void>;
  markLockedFromBackend: () => void;
}

export const useAuthStore = create<AuthState>((set) => {
  const prefs = loadServerPrefs();

  return {
    isLoggedIn: false,
    isLocked: true,
    isLoading: false,
    email: prefs.email,
    serverUrl: "",
    region: prefs.region,
    customServerUrl: prefs.customServerUrl,

    checkStatus: async () => {
      if (!isTauriRuntime()) return;
      try {
        const status = await apiGetAuthStatus();
        set((state) => ({
          isLoggedIn: status.isLoggedIn,
          isLocked: status.isLocked,
          email: status.email ?? state.email,
          serverUrl: status.serverUrl ?? state.serverUrl,
        }));
      } catch {
        // Ignore status check error during startup
      }
    },

    login: async (payload: LoginPayload) => {
      set({ isLoading: true });
      try {
        try {
          localStorage.setItem(
            SERVER_PREF_KEY,
            JSON.stringify({
              email: payload.email,
              region: payload.region,
              customServerUrl: payload.customServerUrl ?? "",
            })
          );
        } catch {
          // Ignore storage error
        }

        const snapshot = await apiLogin(payload);
        set({
          isLoggedIn: true,
          isLocked: false,
          isLoading: false,
          email: snapshot.email,
          serverUrl: snapshot.serverUrl,
          region: payload.region,
          customServerUrl: payload.customServerUrl ?? "",
        });
        return snapshot;
      } catch (err) {
        set({ isLoading: false });
        throw err;
      }
    },

    unlock: async (masterPassword: string) => {
      set({ isLoading: true });
      try {
        const snapshot = await apiUnlockVault(masterPassword);
        set({
          isLoggedIn: true,
          isLocked: false,
          isLoading: false,
          email: snapshot.email,
          serverUrl: snapshot.serverUrl,
        });
        return snapshot;
      } catch (err) {
        set({ isLoading: false });
        throw err;
      }
    },

    lock: async () => {
      if (isTauriRuntime()) {
        await apiLockVault();
      }
      set({ isLocked: true });
    },

    logout: async () => {
      if (isTauriRuntime()) {
        await apiLogout();
      }
      set({ isLoggedIn: false, isLocked: true });
    },

    markLockedFromBackend: () => {
      set({ isLocked: true });
    },
  };
});
