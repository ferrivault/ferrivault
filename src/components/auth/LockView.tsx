import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CircleAlertIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  LockOpenIcon,
  LogOutIcon,
} from "@animateicons/react/lucide";
import { parseBackendError } from "../../lib/utils";
import { useAuthStore } from "../../stores/authStore";
import { useVaultStore } from "../../stores/vaultStore";

export const LockView: React.FC = () => {
  const { t } = useTranslation();
  const auth = useAuthStore();
  const setSnapshot = useVaultStore((s) => s.setSnapshot);
  const clearVaultMemory = useVaultStore((s) => s.clearVaultMemory);

  const [masterPassword, setMasterPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);
    if (!masterPassword) {
      setErrorText(t("errors.validationRequired"));
      return;
    }

    try {
      const snapshot = await auth.unlock(masterPassword);
      setMasterPassword("");
      setSnapshot(snapshot);
    } catch (err) {
      const parsed = parseBackendError(err);
      setErrorText(
        t(parsed.errorKey, {
          message: parsed.message,
          defaultValue: parsed.message,
        })
      );
    }
  };

  const handleLogout = async () => {
    clearVaultMemory();
    await auth.logout();
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-7 shadow-2xl">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-600/20 text-brand-400">
          <LockIcon size={24} />
        </div>

        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-white">
            {t("auth.lockedTitle")}
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            {t("auth.lockedSubtitle")}
          </p>
          {auth.email && (
            <p className="mt-2 inline-block rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300">
              {t("auth.loggedInAs", { email: auth.email })}
            </p>
          )}
        </div>

        {errorText && (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-500/40 bg-red-950/50 p-3 text-xs text-red-200">
            <CircleAlertIcon size={16} className="mt-0.5 shrink-0 text-red-400" />
            <span>{errorText}</span>
          </div>
        )}

        <form onSubmit={(e) => void handleUnlock(e)} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              {t("auth.masterPassword")}
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute left-3 top-2.5 text-slate-400">
                <LockIcon size={16} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                autoFocus
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                placeholder={t("auth.masterPasswordPlaceholder")}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-10 text-sm text-slate-100 placeholder-slate-500 focus:border-brand-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                title={showPassword ? t("common.hide") : t("common.show")}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? (
                  <EyeOffIcon size={16} />
                ) : (
                  <EyeIcon size={16} />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={auth.isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-500 disabled:opacity-50"
          >
            <LockOpenIcon size={16} />
            {auth.isLoading ? t("auth.unlocking") : t("auth.unlockButton")}
          </button>

          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            <LogOutIcon size={14} />
            {t("auth.logoutButton")}
          </button>
        </form>
      </div>
    </div>
  );
};
