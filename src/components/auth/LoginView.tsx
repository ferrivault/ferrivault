import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CircleAlertIcon,
  EyeIcon,
  EyeOffIcon,
  GlobeIcon,
  KeyRoundIcon,
  LockIcon,
  MailIcon,
  ServerIcon,
  ShieldCheckIcon,
} from "@animateicons/react/lucide";
import { SUPPORTED_LOCALES } from "../../i18n/config";
import { parseBackendError } from "../../lib/utils";
import { useAuthStore } from "../../stores/authStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useVaultStore } from "../../stores/vaultStore";
import type { ServerRegion } from "../../types/auth";

/**
 * Crisp inline SVG US flag badge.
 */
const UsFlagSvg: React.FC = () => (
  <svg
    viewBox="0 0 28 20"
    className="h-4 w-6 shrink-0 rounded-[3px] shadow-sm ring-1 ring-white/15"
    aria-hidden="true"
  >
    <rect width="28" height="20" fill="#B22234" />
    <path
      d="M0 2.5h28M0 6.5h28M0 10.5h28M0 14.5h28M0 18.5h28"
      stroke="#FFFFFF"
      strokeWidth="1.6"
    />
    <rect width="12" height="11" fill="#3C3B6E" />
    <circle cx="3" cy="3" r="0.8" fill="#FFFFFF" />
    <circle cx="6" cy="3" r="0.8" fill="#FFFFFF" />
    <circle cx="9" cy="3" r="0.8" fill="#FFFFFF" />
    <circle cx="4.5" cy="5.5" r="0.8" fill="#FFFFFF" />
    <circle cx="7.5" cy="5.5" r="0.8" fill="#FFFFFF" />
    <circle cx="3" cy="8" r="0.8" fill="#FFFFFF" />
    <circle cx="6" cy="8" r="0.8" fill="#FFFFFF" />
    <circle cx="9" cy="8" r="0.8" fill="#FFFFFF" />
  </svg>
);

/**
 * Crisp inline SVG European Union flag badge.
 */
const EuFlagSvg: React.FC = () => (
  <svg
    viewBox="0 0 28 20"
    className="h-4 w-6 shrink-0 rounded-[3px] shadow-sm ring-1 ring-white/15"
    aria-hidden="true"
  >
    <rect width="28" height="20" fill="#003399" />
    <circle
      cx="14"
      cy="10"
      r="5.5"
      fill="none"
      stroke="#FFCC00"
      strokeWidth="1.5"
      strokeDasharray="1.3 1.6"
    />
  </svg>
);

export const LoginView: React.FC = () => {
  const { t } = useTranslation();
  const auth = useAuthStore();
  const setSnapshot = useVaultStore((s) => s.setSnapshot);
  const locale = useSettingsStore((s) => s.locale);
  const changeLanguage = useSettingsStore((s) => s.changeLanguage);

  const [region, setRegion] = useState<ServerRegion>(auth.region);
  const [customServerUrl, setCustomServerUrl] = useState(auth.customServerUrl);
  const [email, setEmail] = useState(auth.email);
  const [masterPassword, setMasterPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [highlightCodeInput, setHighlightCodeInput] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);

    if (!email.trim() || !masterPassword) {
      setErrorText(t("errors.validationRequired"));
      return;
    }
    if (region === "selfHosted" && !customServerUrl.trim()) {
      setErrorText(t("errors.validationRequired"));
      return;
    }

    try {
      const snapshot = await auth.login({
        email: email.trim(),
        masterPassword,
        region,
        customServerUrl:
          region === "selfHosted" ? customServerUrl.trim() : undefined,
        twoFactorCode: twoFactorCode.trim() || undefined,
      });
      setSnapshot(snapshot);
    } catch (err) {
      const parsed = parseBackendError(err);
      if (
        parsed.errorKey === "errors.twoFactorRequired" ||
        parsed.errorKey === "errors.newDeviceVerificationRequired"
      ) {
        setHighlightCodeInput(true);
      }
      setErrorText(
        t(parsed.errorKey, {
          message: parsed.message,
          defaultValue: parsed.message,
        })
      );
    }
  };

  const serverOptions: Array<{
    id: ServerRegion;
    title: string;
    subtitle: string;
    badge: React.ReactNode;
  }> = [
    {
      id: "officialUs",
      title: t("auth.serverUsShort"),
      subtitle: "bitwarden.com",
      badge: <UsFlagSvg />,
    },
    {
      id: "officialEu",
      title: t("auth.serverEuShort"),
      subtitle: "bitwarden.eu",
      badge: <EuFlagSvg />,
    },
    {
      id: "selfHosted",
      title: t("auth.serverSelfHostedShort"),
      subtitle: "Vaultwarden",
      badge: <ServerIcon size={18} className="text-brand-400" />,
    },
  ];

  return (
    <div className="flex h-screen w-screen flex-col justify-between bg-slate-950 p-6 text-slate-100">
      {/* Top Bar with Language Switcher */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white shadow-md shadow-brand-600/30">
            <ShieldCheckIcon size={20} />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-white">
              {t("app.name")}
            </span>
            <span className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400">
              {t("app.version")}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5">
          <GlobeIcon size={16} className="text-slate-400" />
          <select
            aria-label={t("settings.languageLabel")}
            value={locale}
            onChange={(e) => void changeLanguage(e.target.value)}
            className="bg-slate-900 text-xs font-medium text-slate-100 focus:outline-none"
          >
            {SUPPORTED_LOCALES.map((loc) => (
              <option
                key={loc.code}
                value={loc.code}
                className="bg-slate-900 text-slate-100"
              >
                {loc.nativeName} ({loc.code.toUpperCase()})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Login Card */}
      <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-800/90 bg-slate-900/75 p-7 shadow-2xl backdrop-blur">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-white">
            {t("auth.signInTitle")}
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            {t("auth.signInSubtitle")}
          </p>
        </div>

        {errorText && (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-500/40 bg-red-950/50 p-3 text-xs text-red-200">
            <CircleAlertIcon size={16} className="mt-0.5 shrink-0 text-red-400" />
            <span>{errorText}</span>
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {/* Server Environment Radio Cards with Flags */}
          <div>
            <label className="mb-2 block text-xs font-medium text-slate-300">
              {t("auth.serverRegion")}
            </label>
            <div
              role="radiogroup"
              aria-label={t("auth.serverRegion")}
              className="grid grid-cols-3 gap-2.5"
            >
              {serverOptions.map((opt) => {
                const active = region === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setRegion(opt.id)}
                    className={`group relative flex flex-col items-start justify-between rounded-xl border p-3 text-left transition ${
                      active
                        ? "border-brand-500 bg-brand-600/15 shadow-sm shadow-brand-500/20"
                        : "border-slate-800 bg-slate-950/90 hover:border-slate-700 hover:bg-slate-900"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      {opt.badge}
                      <span
                        className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${
                          active
                            ? "border-brand-400 bg-brand-500"
                            : "border-slate-600 bg-transparent"
                        }`}
                      >
                        {active && (
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        )}
                      </span>
                    </div>
                    <div className="mt-2.5">
                      <div
                        className={`text-xs font-semibold ${
                          active ? "text-white" : "text-slate-200"
                        }`}
                      >
                        {opt.title}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {opt.subtitle}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {region === "selfHosted" && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">
                {t("auth.customServerUrl")}
              </label>
              <input
                type="url"
                required
                value={customServerUrl}
                onChange={(e) => setCustomServerUrl(e.target.value)}
                placeholder={t("auth.customServerPlaceholder")}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-brand-500 focus:outline-none"
              />
            </div>
          )}

          {/* Email */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              {t("auth.email")}
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute left-3 top-2.5 text-slate-400">
                <MailIcon size={16} />
              </div>
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.emailPlaceholder")}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Master Password */}
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
                autoComplete="current-password"
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

          {/* 2FA / New Device Verification Code */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              {t("auth.twoFactorCode")}{" "}
              <span className="text-slate-500">({t("common.optional")})</span>
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute left-3 top-2.5 text-slate-400">
                <KeyRoundIcon size={16} />
              </div>
              <input
                type="text"
                inputMode="numeric"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                placeholder={t("auth.twoFactorPlaceholder")}
                className={`w-full rounded-lg border bg-slate-950 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none ${
                  highlightCodeInput
                    ? "border-amber-400 ring-1 ring-amber-400/40"
                    : "border-slate-700 focus:border-brand-500"
                }`}
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {t("auth.twoFactorHint")}
            </p>
          </div>

          <button
            type="submit"
            disabled={auth.isLoading}
            className="mt-2 flex w-full items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-500 disabled:opacity-50"
          >
            {auth.isLoading ? t("auth.loggingIn") : t("auth.loginButton")}
          </button>
        </form>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-slate-500">
        {t("app.tagline")}
      </div>
    </div>
  );
};
