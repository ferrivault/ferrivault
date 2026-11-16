import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckIcon,
  DownloadIcon,
  GlobeIcon,
  InfoIcon,
  MonitorIcon,
  MoonIcon,
  RotateCcwIcon,
  SettingsIcon,
  ShieldIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  SunIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from "@animateicons/react/lucide";
import { SUPPORTED_LOCALES } from "../../i18n/config";
import { apiOpenExternalUrl } from "../../lib/tauri";
import {
  BUILTIN_THEMES,
  DEFAULT_THEME,
  DEFAULT_THEME_SIZING,
  generateThemeTemplateJson,
} from "../../lib/themes";
import { useSettingsStore } from "../../stores/settingsStore";
import { useVaultStore } from "../../stores/vaultStore";
import type { FerriVaultTheme, ThemeSizing } from "../../types/theme";

type SettingsTab = "security" | "appearance" | "language" | "system";

export const SettingsModal: React.FC = () => {
  const { t } = useTranslation();
  const isOpen = useVaultStore((s) => s.isSettingsOpen);
  const closeSettings = useVaultStore((s) => s.closeSettings);
  const pushToast = useVaultStore((s) => s.pushToast);

  const locale = useSettingsStore((s) => s.locale);
  const clipboardClearSeconds = useSettingsStore(
    (s) => s.clipboardClearSeconds
  );
  const autoLockMinutes = useSettingsStore((s) => s.autoLockMinutes);
  const closeToTray = useSettingsStore((s) => s.closeToTray);
  const launchAtStartup = useSettingsStore((s) => s.launchAtStartup);
  const startMinimized = useSettingsStore((s) => s.startMinimized);
  const showFavicons = useSettingsStore((s) => s.showFavicons);
  const activeThemeId = useSettingsStore((s) => s.activeThemeId);
  const customThemes = useSettingsStore((s) => s.customThemes);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const selectTheme = useSettingsStore((s) => s.selectTheme);
  const importCustomTheme = useSettingsStore((s) => s.importCustomTheme);
  const deleteCustomTheme = useSettingsStore((s) => s.deleteCustomTheme);
  const updateActiveThemeSizing = useSettingsStore(
    (s) => s.updateActiveThemeSizing
  );
  const updateInfo = useSettingsStore((s) => s.updateInfo);
  const isCheckingUpdates = useSettingsStore((s) => s.isCheckingUpdates);
  const checkForUpdates = useSettingsStore((s) => s.checkForUpdates);

  const [activeTab, setActiveTab] = useState<SettingsTab>("security");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const allThemes: FerriVaultTheme[] = [...BUILTIN_THEMES, ...customThemes];
  const currentTheme =
    allThemes.find((th) => th.id === activeThemeId) ?? DEFAULT_THEME;
  const [sizingDraft, setSizingDraft] = useState<ThemeSizing>(
    currentTheme.sizing
  );

  if (!isOpen) return null;

  const handleSelectTheme = async (theme: FerriVaultTheme) => {
    setSizingDraft(theme.sizing);
    await selectTheme(theme.id);
  };

  const handleSizingChange = (patch: Partial<ThemeSizing>) => {
    const next = { ...sizingDraft, ...patch };
    setSizingDraft(next);
    void updateActiveThemeSizing(patch);
  };

  const handleResetSizing = () => {
    setSizingDraft({ ...DEFAULT_THEME_SIZING });
    void updateActiveThemeSizing({ ...DEFAULT_THEME_SIZING });
  };

  const handleDownloadTemplate = () => {
    const json = generateThemeTemplateJson({
      ...currentTheme,
      sizing: sizingDraft,
    });
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ferrivault-theme-template.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    pushToast(t("settings.themeTemplateDownloaded"), "info");
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const imported = await importCustomTheme(text);
      setSizingDraft(imported.sizing);
      pushToast(
        t("settings.themeImportSuccess", { name: imported.name }),
        "success"
      );
    } catch {
      pushToast(t("settings.themeImportError"), "error");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const tabs: Array<{
    id: SettingsTab;
    label: string;
    Icon: React.ComponentType<{ size?: number; className?: string }>;
  }> = [
    {
      id: "security",
      label: t("settings.tabs.security"),
      Icon: ShieldIcon,
    },
    {
      id: "appearance",
      label: t("settings.tabs.appearance"),
      Icon: SparklesIcon,
    },
    {
      id: "language",
      label: t("settings.tabs.language"),
      Icon: GlobeIcon,
    },
    {
      id: "system",
      label: t("settings.tabs.system"),
      Icon: MonitorIcon,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="flex h-[580px] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        {/* Top Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600/20 text-brand-400">
              <SettingsIcon size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {t("settings.title")}
              </h2>
              <p className="text-[11px] text-slate-400">
                {t("settings.subtitle")}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeSettings}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <XIcon size={20} />
          </button>
        </div>

        {/* Body with Sidebar Tabs + Active Panel */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Left Tab Navigation */}
          <nav className="flex w-48 shrink-0 flex-col gap-1 border-r border-slate-800 bg-slate-950/50 p-3 text-xs">
            {tabs.map(({ id, label, Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left font-medium transition ${
                    active
                      ? "bg-brand-600/20 text-brand-300"
                      : "text-slate-300 hover:bg-slate-800/60"
                  }`}
                >
                  <Icon
                    size={16}
                    className={active ? "text-brand-400" : "text-slate-400"}
                  />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Content Area */}
          <div className="flex-1 overflow-y-auto p-6 text-xs">
            {/* TAB 1: SECURITY */}
            {activeTab === "security" && (
              <div className="space-y-5">
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="mb-3 flex items-center gap-2 font-semibold text-slate-100">
                    <ShieldIcon size={16} className="text-brand-400" />
                    <span>{t("settings.autoLockLabel")}</span>
                  </div>

                  <p className="mb-3 text-[11px] text-slate-400">
                    {t("settings.autoLockHelp")}
                  </p>

                  {/* Preset Pills */}
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {[
                      { value: 0, label: t("settings.autoLockNever") },
                      { value: 1, label: "1 min" },
                      { value: 5, label: t("settings.autoLock5m") },
                      { value: 15, label: t("settings.autoLock15m") },
                      { value: 30, label: t("settings.autoLock30m") },
                      { value: 60, label: t("settings.autoLock1h") },
                      { value: 240, label: "4 h" },
                    ].map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() =>
                          void updateSettings({ autoLockMinutes: preset.value })
                        }
                        className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
                          autoLockMinutes === preset.value
                            ? "border-brand-500 bg-brand-600/20 text-brand-300"
                            : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {/* Custom Minutes Input */}
                  <div className="flex items-center gap-3 pt-1">
                    <label className="text-slate-300">
                      {t("settings.autoLockCustomMinutes")}:
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={1440}
                      value={autoLockMinutes}
                      onChange={(e) => {
                        const val = Math.max(
                          0,
                          Math.min(1440, Number(e.target.value) || 0)
                        );
                        void updateSettings({ autoLockMinutes: val });
                      }}
                      className="w-24 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 font-mono text-xs text-slate-100 focus:border-brand-500 focus:outline-none"
                    />
                    <span className="text-[11px] text-slate-500">
                      {t("settings.minutesUnit")}
                    </span>
                  </div>
                </div>

                {/* Clipboard Auto-Clear */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <label className="mb-1.5 block font-semibold text-slate-100">
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

                {/* Website Favicons */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <label className="flex cursor-pointer items-start gap-2.5 text-slate-300">
                    <input
                      type="checkbox"
                      checked={showFavicons}
                      onChange={(e) =>
                        void updateSettings({ showFavicons: e.target.checked })
                      }
                      className="mt-0.5 rounded border-slate-700 bg-slate-900 text-brand-600"
                    />
                    <div>
                      <span className="block font-semibold text-slate-100">
                        {t("settings.showFaviconsLabel")}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-slate-400">
                        {t("settings.showFaviconsDesc")}
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* TAB 2: APPEARANCE & THEMES */}
            {activeTab === "appearance" && (
              <div className="space-y-5">
                {/* Theme Gallery */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-semibold text-slate-100">
                      <SparklesIcon size={16} className="text-brand-400" />
                      <span>{t("settings.themesSection")}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {allThemes.map((th) => {
                      const selected = th.id === currentTheme.id;
                      return (
                        <div
                          key={th.id}
                          onClick={() => void handleSelectTheme(th)}
                          className={`group relative flex cursor-pointer flex-col justify-between rounded-xl border p-3 transition ${
                            selected
                              ? "border-brand-500 bg-brand-600/15 ring-1 ring-brand-500/30"
                              : "border-slate-800 bg-slate-900/70 hover:border-slate-700"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 font-semibold text-slate-100">
                                <span className="truncate">{th.name}</span>
                                {selected && (
                                  <CheckIcon
                                    size={13}
                                    className="shrink-0 text-brand-400"
                                  />
                                )}
                              </div>
                              <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-400">
                                {th.colorScheme === "light" ? (
                                  <SunIcon size={11} />
                                ) : (
                                  <MoonIcon size={11} />
                                )}
                                <span>
                                  {th.colorScheme === "light"
                                    ? t("settings.themeLight")
                                    : t("settings.themeDark")}
                                </span>
                                {th.author && <span>• {th.author}</span>}
                              </div>
                            </div>

                            {!th.isBuiltIn && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void deleteCustomTheme(th.id);
                                }}
                                title={t("common.delete")}
                                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-red-400"
                              >
                                <Trash2Icon size={13} />
                              </button>
                            )}
                          </div>

                          {/* Color Swatch Preview Strip */}
                          <div className="mt-2.5 flex h-4 overflow-hidden rounded-md border border-black/20">
                            <span
                              className="flex-1"
                              style={{
                                backgroundColor: th.colors.appBackground,
                              }}
                            />
                            <span
                              className="flex-1"
                              style={{
                                backgroundColor: th.colors.panelBackground,
                              }}
                            />
                            <span
                              className="flex-1"
                              style={{
                                backgroundColor: th.colors.cardBackground,
                              }}
                            />
                            <span
                              className="flex-1"
                              style={{
                                backgroundColor: th.colors.accentPrimary,
                              }}
                            />
                            <span
                              className="flex-1"
                              style={{
                                backgroundColor: th.colors.accentLight,
                              }}
                            />
                            <span
                              className="flex-1"
                              style={{
                                backgroundColor: th.colors.textPrimary,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Theme Template Download & Upload */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="mb-1.5 font-semibold text-slate-100">
                    {t("settings.customThemeTitle")}
                  </div>
                  <p className="mb-3 text-[11px] leading-relaxed text-slate-400">
                    {t("settings.customThemeDesc")}
                  </p>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleDownloadTemplate}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-medium text-slate-200 transition hover:bg-slate-800"
                    >
                      <DownloadIcon size={14} className="text-brand-400" />
                      {t("settings.downloadThemeTemplate")}
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 font-semibold text-white transition hover:bg-brand-500"
                    >
                      <UploadIcon size={14} />
                      {t("settings.uploadCustomTheme")}
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,application/json"
                      onChange={(e) => void handleFileImport(e)}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Sizing & Layout Sliders */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-semibold text-slate-100">
                      <SlidersHorizontalIcon
                        size={16}
                        className="text-brand-400"
                      />
                      <span>{t("settings.sizingSection")}</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleResetSizing}
                      className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"
                    >
                      <RotateCcwIcon size={12} />
                      {t("settings.resetSizing")}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="mb-1 flex justify-between text-slate-300">
                        <span>{t("settings.fontSizeLabel")}</span>
                        <span className="font-mono text-brand-400">
                          {sizingDraft.baseFontSizePx}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={13}
                        max={20}
                        value={sizingDraft.baseFontSizePx}
                        onChange={(e) =>
                          handleSizingChange({
                            baseFontSizePx: Number(e.target.value),
                          })
                        }
                        className="w-full accent-brand-500"
                      />
                    </div>

                    <div>
                      <div className="mb-1 flex justify-between text-slate-300">
                        <span>{t("settings.borderRadiusLabel")}</span>
                        <span className="font-mono text-brand-400">
                          {sizingDraft.borderRadiusPx}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={4}
                        max={20}
                        value={sizingDraft.borderRadiusPx}
                        onChange={(e) =>
                          handleSizingChange({
                            borderRadiusPx: Number(e.target.value),
                          })
                        }
                        className="w-full accent-brand-500"
                      />
                    </div>

                    <div>
                      <div className="mb-1 flex justify-between text-slate-300">
                        <span>{t("settings.sidebarWidthLabel")}</span>
                        <span className="font-mono text-brand-400">
                          {sizingDraft.sidebarWidthPx}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={200}
                        max={340}
                        step={10}
                        value={sizingDraft.sidebarWidthPx}
                        onChange={(e) =>
                          handleSizingChange({
                            sidebarWidthPx: Number(e.target.value),
                          })
                        }
                        className="w-full accent-brand-500"
                      />
                    </div>

                    <div>
                      <div className="mb-1 flex justify-between text-slate-300">
                        <span>{t("settings.listWidthLabel")}</span>
                        <span className="font-mono text-brand-400">
                          {sizingDraft.listWidthPx}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={260}
                        max={440}
                        step={10}
                        value={sizingDraft.listWidthPx}
                        onChange={(e) =>
                          handleSizingChange({
                            listWidthPx: Number(e.target.value),
                          })
                        }
                        className="w-full accent-brand-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: LANGUAGE */}
            {activeTab === "language" && (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="mb-3 flex items-center gap-2 font-semibold text-slate-100">
                    <GlobeIcon size={16} className="text-brand-400" />
                    <span>{t("settings.languageSection")}</span>
                  </div>

                  <div className="space-y-2">
                    {SUPPORTED_LOCALES.map((loc) => {
                      const active = locale === loc.code;
                      return (
                        <button
                          key={loc.code}
                          type="button"
                          onClick={() =>
                            void updateSettings({ locale: loc.code })
                          }
                          className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                            active
                              ? "border-brand-500 bg-brand-600/15 text-brand-300"
                              : "border-slate-800 bg-slate-900/70 text-slate-200 hover:border-slate-700"
                          }`}
                        >
                          <div>
                            <div className="font-semibold">
                              {loc.nativeName}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {loc.name} ({loc.code.toUpperCase()})
                            </div>
                          </div>
                          {active && (
                            <CheckIcon size={16} className="text-brand-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <p className="mt-3 text-[11px] text-slate-400">
                    {t("settings.languageHelp")}
                  </p>
                </div>
              </div>
            )}

            {/* TAB 4: SYSTEM, SHORTCUTS & ABOUT */}
            {activeTab === "system" && (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="mb-2.5 flex items-center gap-2 font-semibold text-slate-100">
                    <MonitorIcon size={16} className="text-brand-400" />
                    <span>{t("settings.traySection")}</span>
                  </div>

                  <div className="space-y-3">
                    <label className="flex cursor-pointer items-start gap-2.5 text-slate-300">
                      <input
                        type="checkbox"
                        checked={closeToTray}
                        onChange={(e) =>
                          void updateSettings({ closeToTray: e.target.checked })
                        }
                        className="mt-0.5 rounded border-slate-700 bg-slate-900 text-brand-600"
                      />
                      <div>
                        <span className="block font-medium text-slate-100">
                          {t("settings.closeToTrayLabel")}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-slate-400">
                          {t("settings.closeToTrayDesc")}
                        </span>
                      </div>
                    </label>

                    <label className="flex cursor-pointer items-start gap-2.5 text-slate-300">
                      <input
                        type="checkbox"
                        checked={launchAtStartup}
                        onChange={(e) =>
                          void updateSettings({
                            launchAtStartup: e.target.checked,
                          })
                        }
                        className="mt-0.5 rounded border-slate-700 bg-slate-900 text-brand-600"
                      />
                      <div>
                        <span className="block font-medium text-slate-100">
                          {t("settings.launchAtStartupLabel")}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-slate-400">
                          {t("settings.launchAtStartupDesc")}
                        </span>
                      </div>
                    </label>

                    <label className="flex cursor-pointer items-start gap-2.5 text-slate-300">
                      <input
                        type="checkbox"
                        checked={startMinimized}
                        onChange={(e) =>
                          void updateSettings({
                            startMinimized: e.target.checked,
                          })
                        }
                        className="mt-0.5 rounded border-slate-700 bg-slate-900 text-brand-600"
                      />
                      <div>
                        <span className="block font-medium text-slate-100">
                          {t("settings.startMinimizedLabel")}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-slate-400">
                          {t("settings.startMinimizedDesc")}
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Keyboard Shortcuts Reference */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="mb-2.5 font-semibold text-slate-100">
                    {t("settings.shortcutsTitle")}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    {[
                      {
                        keys: "Ctrl + F / Ctrl + K",
                        label: t("common.searchPlaceholder"),
                      },
                      { keys: "Ctrl + N", label: t("vault.newItem") },
                      {
                        keys: "Ctrl + G",
                        label: t("sidebar.passwordGenerator"),
                      },
                      { keys: "Ctrl + L", label: t("auth.lockButton") },
                      { keys: "Ctrl + R", label: t("sidebar.syncVault") },
                      { keys: "Ctrl + ,", label: t("sidebar.settings") },
                    ].map((sc) => (
                      <div
                        key={sc.keys}
                        className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-900/60 px-2.5 py-1.5"
                      >
                        <span className="truncate text-slate-300">
                          {sc.label}
                        </span>
                        <kbd className="ml-2 shrink-0 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-brand-300">
                          {sc.keys}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>

                {/* About & Updates */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-semibold text-slate-100">
                      <InfoIcon size={16} className="text-brand-400" />
                      <span>
                        {t("settings.aboutSection")} (
                        {updateInfo
                          ? `v${updateInfo.currentVersion}`
                          : t("app.version")}
                        )
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={isCheckingUpdates}
                      onClick={() => {
                        void checkForUpdates(false)
                          .then((res) => {
                            if (!res) return;
                            if (res.updateAvailable) {
                              pushToast(
                                t("notifications.updateAvailable", {
                                  version: res.latestVersion,
                                }),
                                "info"
                              );
                            } else {
                              pushToast(t("notifications.upToDate"), "success");
                            }
                          })
                          .catch(() => {
                            pushToast(t("errors.networkError"), "error");
                          });
                      }}
                      className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-200 transition hover:border-brand-500 hover:text-white disabled:opacity-50"
                    >
                      {isCheckingUpdates
                        ? t("settings.checkingUpdates")
                        : t("settings.checkForUpdates")}
                    </button>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-400">
                    {t("settings.aboutDescription")}
                  </p>

                  {updateInfo?.updateAvailable && (
                    <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-brand-500/40 bg-brand-600/10 px-3 py-2">
                      <span className="text-[11px] font-medium text-brand-300">
                        {t("settings.updateAvailableLabel", {
                          version: updateInfo.latestVersion,
                        })}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          void apiOpenExternalUrl(updateInfo.releaseUrl)
                        }
                        className="shrink-0 rounded-md bg-brand-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-brand-500"
                      >
                        {t("settings.downloadUpdate")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-800 px-6 py-3.5">
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
