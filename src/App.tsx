import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";
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
  const markLockedFromBackend = useAuthStore((s) => s.markLockedFromBackend);

  const initializeSettings = useSettingsStore((s) => s.initializeSettings);

  const editingCipher = useVaultStore((s) => s.editingCipher);
  const toasts = useVaultStore((s) => s.toasts);
  const openGenerator = useVaultStore((s) => s.openGenerator);
  const syncVault = useVaultStore((s) => s.syncVault);
  const clearVaultMemory = useVaultStore((s) => s.clearVaultMemory);
  const pushToast = useVaultStore((s) => s.pushToast);

  useEffect(() => {
    void initializeSettings();
    void checkStatus();
  }, [initializeSettings, checkStatus]);

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
  }, [openGenerator, syncVault, clearVaultMemory, markLockedFromBackend, pushToast, t]);

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
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            )}
            {toast.variant === "error" && (
              <AlertCircle className="h-4 w-4 text-red-400" />
            )}
            {toast.variant === "info" && (
              <Info className="h-4 w-4 text-brand-400" />
            )}
            <span>{toast.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
