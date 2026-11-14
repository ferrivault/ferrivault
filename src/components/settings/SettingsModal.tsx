import React from "react";
import { useTranslation } from "react-i18next";
import {
  GlobeIcon,
  InfoIcon,
  MonitorIcon,
  SettingsIcon,
  ShieldIcon,
  XIcon,
} from "@animateicons/react/lucide";
import { SUPPORTED_LOCALES } from "../../i18n/config";
import { useSettingsStore } from "../../stores/settingsStore";
import { useVaultStore } from "../../stores/vaultStore";

export const SettingsModal: React.FC = () => {
  const { t } = useTranslation();
  const isOpen = useVaultStore((s) => s.isSettingsOpen);
  const closeSettings = useVaultStore((s) => s.closeSettings);

  const locale = useSettingsStore((s) => s.locale);
  const clipboardClearSeconds = useSettingsStore(
    (s) => s.clipboardClearSeconds
  );
  const autoLockMinutes = useSettingsStore((s) => s.autoLockMinutes);
  const closeToTray = useSettingsStore((s) => s.closeToTray);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600/20 text-brand-400">
              <SettingsIcon size={20} />
            </div>
            <h2 className="text-base font-bold text-white">
              {t("settings.title")}
            </h2>
          </div>

          <button
            type="button"
            onClick={closeSettings}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <XIcon size={20} />
          </button>
        </div>

        <div className="mt-5 space-y-5 text-xs">
          {/* Language & Localization */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="mb-2.5 flex items-center gap-2 font-semibold text-slate-200">
              <GlobeIcon size={16} className="text-brand-400" />
              <span>{t("settings.languageSection")}</span>
            </div>

            <label className="mb-1.5 block text-slate-300">
              {t("settings.languageLabel")}
            </label>
            <select
              value={locale}
              onChange={(e) =>
                void updateSettings({ locale: e.target.value })
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus:border-brand-500 focus:outline-none"
            >
              {SUPPORTED_LOCALES.map((loc) => (
                <option key={loc.code} value={loc.code}>
                  {loc.nativeName} — {loc.name} ({loc.code})
                </option>
              ))}
            </select>
            <p className="mt-2 text-[11px] text-slate-500">
              {t("settings.languageHelp")}
            </p>
          </div>

          {/* Security & Clipboard */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="mb-2.5 flex items-center gap-2 font-semibold text-slate-200">
              <ShieldIcon size={16} className="text-brand-400" />
              <span>{t("settings.securitySection")}</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-slate-300">
                  {t("settings.clipboardClearLabel")}
                </label>
                <select
                  value={clipboardClearSeconds}
                  onChange={(e) =>
                    void updateSettings({
                      clipboardClearSeconds: Number(e.target.value),
                    })
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus:border-brand-500 focus:outline-none"
                >
                  <option value={0}>{t("settings.clipboardNever")}</option>
                  <option value={10}>{t("settings.clipboard10s")}</option>
                  <option value={20}>{t("settings.clipboard20s")}</option>
                  <option value={30}>{t("settings.clipboard30s")}</option>
                  <option value={60}>{t("settings.clipboard1m")}</option>
                  <option value={120}>{t("settings.clipboard2m")}</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-slate-300">
                  {t("settings.autoLockLabel")}
                </label>
                <select
                  value={autoLockMinutes}
                  onChange={(e) =>
                    void updateSettings({
                      autoLockMinutes: Number(e.target.value),
                    })
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus:border-brand-500 focus:outline-none"
                >
                  <option value={0}>{t("settings.autoLockNever")}</option>
                  <option value={5}>{t("settings.autoLock5m")}</option>
                  <option value={15}>{t("settings.autoLock15m")}</option>
                  <option value={30}>{t("settings.autoLock30m")}</option>
                  <option value={60}>{t("settings.autoLock1h")}</option>
                </select>
              </div>
            </div>
          </div>

          {/* System Tray Integration */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="mb-2.5 flex items-center gap-2 font-semibold text-slate-200">
              <MonitorIcon size={16} className="text-brand-400" />
              <span>{t("settings.traySection")}</span>
            </div>

            <label className="flex items-start gap-2.5 text-slate-300">
              <input
                type="checkbox"
                checked={closeToTray}
                onChange={(e) =>
                  void updateSettings({ closeToTray: e.target.checked })
                }
                className="mt-0.5 rounded border-slate-700 bg-slate-900 text-brand-600"
              />
              <div>
                <span className="block font-medium text-slate-200">
                  {t("settings.closeToTrayLabel")}
                </span>
                <span className="mt-0.5 block text-[11px] text-slate-500">
                  {t("settings.closeToTrayDesc")}
                </span>
              </div>
            </label>
          </div>

          {/* About */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="mb-1.5 flex items-center gap-2 font-semibold text-slate-200">
              <InfoIcon size={16} className="text-brand-400" />
              <span>
                {t("settings.aboutSection")} ({t("app.version")})
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400">
              {t("settings.aboutDescription")}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 flex justify-end border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={closeSettings}
            className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-500"
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
};
