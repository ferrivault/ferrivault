import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Globe,
  KeyRound,
  Lock,
  Mail,
  Server,
  ShieldCheck,
  Eye,
  EyeOff,
  AlertCircle,
} from "lucide-react";
import { SUPPORTED_LOCALES } from "../../i18n/config";
import { parseBackendError } from "../../lib/utils";
import { useAuthStore } from "../../stores/authStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useVaultStore } from "../../stores/vaultStore";
import type { ServerRegion } from "../../types/auth";

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
      setErrorText(
        t(parsed.errorKey, {
          message: parsed.message,
          defaultValue: parsed.message,
        })
      );
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col justify-between bg-slate-950 p-6 text-slate-100">
      {/* Top Bar with Language Switcher */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white shadow-md shadow-brand-600/30">
            <ShieldCheck className="h-5 w-5" />
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

        <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-1.5">
          <Globe className="h-4 w-4 text-slate-400" />
          <select
            aria-label={t("settings.languageLabel")}
            value={locale}
            onChange={(e) => void changeLanguage(e.target.value)}
            className="bg-transparent text-xs font-medium text-slate-200 focus:outline-none"
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
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <span>{errorText}</span>
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {/* Server Environment Selector */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              {t("auth.serverRegion")}
            </label>
            <div className="relative">
              <Server className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value as ServerRegion)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-slate-100 focus:border-brand-500 focus:outline-none"
              >
                <option value="officialUs">{t("auth.serverOfficialUs")}</option>
                <option value="officialEu">{t("auth.serverOfficialEu")}</option>
                <option value="selfHosted">{t("auth.serverSelfHosted")}</option>
              </select>
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
              <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
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
              <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
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
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Optional 2FA TOTP Code */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              {t("auth.twoFactorCode")}{" "}
              <span className="text-slate-500">({t("common.optional")})</span>
            </label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                inputMode="numeric"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                placeholder={t("auth.twoFactorPlaceholder")}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:border-brand-500 focus:outline-none"
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
