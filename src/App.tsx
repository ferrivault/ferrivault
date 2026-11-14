import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import {
  CircleAlertIcon,
  CircleCheckIcon,
  InfoIcon,
} from "@animateicons/react/lucide";
import { isTauriRuntime } from "./lib/tauri";
import { useAuthStore } from "./stores/authStore";
import { useSettingsStore } from "./stores/settingsStore";
import { useVaultStore } from "./stores/vaultStore";
import { LoginView } from "./components/auth/LoginView";
import { LockView } from "./components/auth/LockView";
import { Sidebar } from "./components/layout/Sidebar";
import { CipherList } from "./components/vault/CipherList";
import { CipherDetail } from "./components/vault/CipherDetail";
import { CipherForm } from "./components/vault/CipherForm";
import { GeneratorModal } from "./components/tools/GeneratorModal";
import { SettingsModal } from "./components/settings/SettingsModal";

export default function App(): React.ReactElement {
  const { t } = useTranslation();

  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const isLocked = useAuthStore((s) => s.isLocked);
  const checkStatus = useAuthStore((s) => s.checkStatus);
  const lock = useAuthStore((s) => s.lock);
  const markLockedFromBackend = useAuthStore((s) => s.markLockedFromBackend);

  const initializeSettings = useSettingsStore((s) => s.initializeSettings);
  const autoLockMinutes = useSettingsStore((s) => s.autoLockMinutes);

  const editingCipher = useVaultStore((s) => s.editingCipher);
  const toasts = useVaultStore((s) => s.toasts);
  const isGeneratorOpen = useVaultStore((s) => s.isGeneratorOpen);
  const isSettingsOpen = useVaultStore((s) => s.isSettingsOpen);
  const openGenerator = useVaultStore((s) => s.openGenerator);
  const closeGenerator = useVaultStore((s) => s.closeGenerator);
  const openSettings = useVaultStore((s) => s.openSettings);
  const closeSettings = useVaultStore((s) => s.closeSettings);
  const startCreateCipher = useVaultStore((s) => s.startCreateCipher);
  const syncVault = useVaultStore((s) => s.syncVault);
  const clearVaultMemory = useVaultStore((s) => s.clearVaultMemory);
  const pushToast = useVaultStore((s) => s.pushToast);

  useEffect(() => {
    void initializeSettings();
    void checkStatus();
  }, [initializeSettings, checkStatus]);

  // Inactivity Auto-Lock Timer
  useEffect(() => {
    if (!isLoggedIn || isLocked || autoLockMinutes <= 0) {
      return;
    }

    const timeoutMs = autoLockMinutes * 60 * 1000;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const resetTimer = () => {
      if (timerId !== null) {
        clearTimeout(timerId);
      }
      timerId = setTimeout(() => {
        clearVaultMemory();
        void lock().then(() => {
          pushToast(t("notifications.vaultAutoLocked"), "info");
        });
      }, timeoutMs);
    };

    const activityEvents: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "wheel",
      "touchstart",
      "focus",
    ];

    resetTimer();
    for (const evt of activityEvents) {
      window.addEventListener(evt, resetTimer, { passive: true });
    }

    return () => {
      if (timerId !== null) {
        clearTimeout(timerId);
      }
      for (const evt of activityEvents) {
        window.removeEventListener(evt, resetTimer);
      }
    };
  }, [
    isLoggedIn,
    isLocked,
    autoLockMinutes,
    clearVaultMemory,
    lock,
    pushToast,
    t,
  ]);

  // Global Application Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isGeneratorOpen) {
          e.preventDefault();
          closeGenerator();
          return;
        }
        if (isSettingsOpen) {
          e.preventDefault();
          closeSettings();
          return;
        }
      }

      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod) return;

      const key = e.key.toLowerCase();

      // Ctrl/Cmd + , -> Open Settings & Preferences
      if (key === ",") {
        e.preventDefault();
        openSettings();
        return;
      }

      if (!isLoggedIn || isLocked) return;

      // Ctrl/Cmd + F or Ctrl/Cmd + K -> Focus search bar
      if (key === "f" || key === "k") {
        const searchInput = document.getElementById(
          "vault-search-input"
        ) as HTMLInputElement | null;
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      // Ctrl/Cmd + L -> Lock Vault immediately
      if (key === "l") {
        e.preventDefault();
        clearVaultMemory();
        void lock().then(() => {
          pushToast(t("notifications.vaultLocked"), "info");
        });
        return;
      }

      // Ctrl/Cmd + G -> Open Password Generator
      if (key === "g") {
        e.preventDefault();
        openGenerator();
        return;
      }

      // Ctrl/Cmd + N -> New Vault Item
      if (key === "n") {
        e.preventDefault();
        startCreateCipher();
        return;
      }

      // Ctrl/Cmd + R -> Sync Vault
      if (key === "r") {
        e.preventDefault();
        void syncVault().then(() => {
          pushToast(t("notifications.syncSuccess"), "success");
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isLoggedIn,
    isLocked,
    isGeneratorOpen,
    isSettingsOpen,
    closeGenerator,
    openSettings,
    closeSettings,
    clearVaultMemory,
    lock,
    openGenerator,
    startCreateCipher,
    syncVault,
    pushToast,
    t,
  ]);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    const unlistenPromises = [
      listen("tray:open-generator", () => {
        openGenerator();
      }),
      listen("tray:sync-vault", () => {
        void syncVault().then(() => {
          pushToast(t("notifications.syncSuccess"), "success");
        });
      }),
      listen("tray:vault-locked", () => {
        clearVaultMemory();
        markLockedFromBackend();
        pushToast(t("notifications.vaultLocked"), "info");
      }),
      listen("clipboard:cleared", () => {
        pushToast(t("notifications.clipboardCleared"), "info");
      }),
    ];

    return () => {
      for (const p of unlistenPromises) {
        void p.then((unlisten) => unlisten());
      }
    };
  }, [
    openGenerator,
    syncVault,
    clearVaultMemory,
    markLockedFromBackend,
    pushToast,
    t,
  ]);

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {!isLoggedIn ? (
        <LoginView />
      ) : isLocked ? (
        <LockView />
      ) : (
        <div className="flex h-full w-full overflow-hidden">
          <Sidebar />
          <CipherList />
          {editingCipher ? (
            <CipherForm key={editingCipher.id || "new"} />
          ) : (
            <CipherDetail />
          )}
        </div>
      )}

      {/* Global Modals */}
      <GeneratorModal />
      <SettingsModal />

      {/* Toast Notifications */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/95 px-4 py-2.5 text-xs font-medium text-slate-100 shadow-xl backdrop-blur"
          >
            {toast.variant === "success" && (
              <CircleCheckIcon size={16} className="text-emerald-400" />
            )}
            {toast.variant === "error" && (
              <CircleAlertIcon size={16} className="text-red-400" />
            )}
            {toast.variant === "info" && (
              <InfoIcon size={16} className="text-brand-400" />
            )}
            <span>{toast.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
