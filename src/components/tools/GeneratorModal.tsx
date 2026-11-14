import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Check,
  Copy,
  KeyRound,
  RefreshCw,
  X,
} from "lucide-react";
import {
  apiCopyToClipboard,
  apiGeneratePassphrase,
  apiGeneratePassword,
} from "../../lib/tauri";
import { useVaultStore } from "../../stores/vaultStore";
import type {
  PassphraseGeneratorOptions,
  PasswordGeneratorOptions,
} from "../../types/vault";

export const GeneratorModal: React.FC = () => {
  const { t } = useTranslation();
  const isOpen = useVaultStore((s) => s.isGeneratorOpen);
  const callback = useVaultStore((s) => s.generatorCallback);
  const closeGenerator = useVaultStore((s) => s.closeGenerator);
  const pushToast = useVaultStore((s) => s.pushToast);

  const [mode, setMode] = useState<"password" | "passphrase">("password");
  const [generatedValue, setGeneratedValue] = useState("");
  const [copied, setCopied] = useState(false);

  const [pwdOpts, setPwdOpts] = useState<PasswordGeneratorOptions>({
    length: 18,
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
    minNumbers: 2,
    minSymbols: 2,
    avoidAmbiguous: false,
  });

  const [phraseOpts, setPhraseOpts] = useState<PassphraseGeneratorOptions>({
    numWords: 4,
    wordSeparator: "-",
    capitalize: true,
    includeNumber: true,
  });

  const generateNewValue = useCallback(async () => {
    try {
      if (mode === "password") {
        const val = await apiGeneratePassword(pwdOpts);
        setGeneratedValue(val);
      } else {
        const val = await apiGeneratePassphrase(phraseOpts);
        setGeneratedValue(val);
      }
    } catch {
      // Ignore transient validation state when all checkboxes are unchecked
    }
  }, [mode, pwdOpts, phraseOpts]);

  useEffect(() => {
    if (isOpen) {
      void generateNewValue();
    }
  }, [isOpen, generateNewValue]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    if (!generatedValue) return;
    await apiCopyToClipboard(generatedValue);
    setCopied(true);
    pushToast(
      t("notifications.copied", { field: t("generator.typePassword") }),
      "success"
    );
    setTimeout(() => setCopied(false), 1500);
  };

  const handleUsePassword = () => {
    if (callback && generatedValue) {
      callback(generatedValue);
    }
    closeGenerator();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600/20 text-brand-400">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {t("generator.title")}
              </h2>
              <p className="text-xs text-slate-400">
                {t("generator.subtitle")}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeGenerator}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Generated Preview Box */}
        <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-slate-700/80 bg-slate-950 p-4">
          <div className="break-all font-mono text-base font-semibold tracking-wide text-brand-300">
            {generatedValue}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => void generateNewValue()}
              title={t("generator.regenerate")}
              className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-300 transition hover:bg-slate-700 hover:text-white"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void handleCopy()}
              title={t("generator.copyPassword")}
              className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-300 transition hover:bg-slate-700 hover:text-white"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-slate-950 p-1">
          <button
            type="button"
            onClick={() => setMode("password")}
            className={`rounded-md py-1.5 text-xs font-semibold transition ${
              mode === "password"
                ? "bg-brand-600 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {t("generator.typePassword")}
          </button>
          <button
            type="button"
            onClick={() => setMode("passphrase")}
            className={`rounded-md py-1.5 text-xs font-semibold transition ${
              mode === "passphrase"
                ? "bg-brand-600 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {t("generator.typePassphrase")}
          </button>
        </div>

        {/* Options Body */}
        {mode === "password" ? (
          <div className="mt-4 space-y-3 text-xs">
            <div>
              <div className="mb-1 flex justify-between font-medium text-slate-300">
                <span>{t("generator.length")}</span>
                <span className="font-mono text-brand-400">
                  {pwdOpts.length}
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={64}
                value={pwdOpts.length}
                onChange={(e) =>
                  setPwdOpts((p) => ({
                    ...p,
                    length: Number(e.target.value),
                  }))
                }
                className="w-full accent-brand-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={pwdOpts.uppercase}
                  onChange={(e) =>
                    setPwdOpts((p) => ({ ...p, uppercase: e.target.checked }))
                  }
                  className="rounded border-slate-700 bg-slate-950 text-brand-600"
                />
                {t("generator.uppercase")}
              </label>

              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={pwdOpts.lowercase}
                  onChange={(e) =>
                    setPwdOpts((p) => ({ ...p, lowercase: e.target.checked }))
                  }
                  className="rounded border-slate-700 bg-slate-950 text-brand-600"
                />
                {t("generator.lowercase")}
              </label>

              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={pwdOpts.numbers}
                  onChange={(e) =>
                    setPwdOpts((p) => ({ ...p, numbers: e.target.checked }))
                  }
                  className="rounded border-slate-700 bg-slate-950 text-brand-600"
                />
                {t("generator.numbers")}
              </label>

              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={pwdOpts.symbols}
                  onChange={(e) =>
                    setPwdOpts((p) => ({ ...p, symbols: e.target.checked }))
                  }
                  className="rounded border-slate-700 bg-slate-950 text-brand-600"
                />
                {t("generator.symbols")}
              </label>
            </div>

            <label className="flex items-center gap-2 pt-1 text-slate-300">
              <input
                type="checkbox"
                checked={pwdOpts.avoidAmbiguous}
                onChange={(e) =>
                  setPwdOpts((p) => ({
                    ...p,
                    avoidAmbiguous: e.target.checked,
                  }))
                }
                className="rounded border-slate-700 bg-slate-950 text-brand-600"
              />
              {t("generator.avoidAmbiguous")}
            </label>
          </div>
        ) : (
          <div className="mt-4 space-y-3 text-xs">
            <div>
              <div className="mb-1 flex justify-between font-medium text-slate-300">
                <span>{t("generator.numWords")}</span>
                <span className="font-mono text-brand-400">
                  {phraseOpts.numWords}
                </span>
              </div>
              <input
                type="range"
                min={3}
                max={12}
                value={phraseOpts.numWords}
                onChange={(e) =>
                  setPhraseOpts((p) => ({
                    ...p,
                    numWords: Number(e.target.value),
                  }))
                }
                className="w-full accent-brand-500"
              />
            </div>

            <div>
              <label className="mb-1 block font-medium text-slate-300">
                {t("generator.wordSeparator")}
              </label>
              <input
                type="text"
                maxLength={3}
                value={phraseOpts.wordSeparator}
                onChange={(e) =>
                  setPhraseOpts((p) => ({
                    ...p,
                    wordSeparator: e.target.value,
                  }))
                }
                className="w-24 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100"
              />
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={phraseOpts.capitalize}
                  onChange={(e) =>
                    setPhraseOpts((p) => ({
                      ...p,
                      capitalize: e.target.checked,
                    }))
                  }
                  className="rounded border-slate-700 bg-slate-950 text-brand-600"
                />
                {t("generator.capitalize")}
              </label>

              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={phraseOpts.includeNumber}
                  onChange={(e) =>
                    setPhraseOpts((p) => ({
                      ...p,
                      includeNumber: e.target.checked,
                    }))
                  }
                  className="rounded border-slate-700 bg-slate-950 text-brand-600"
                />
                {t("generator.includeNumber")}
              </label>
            </div>
          </div>
        )}

        {/* Footer Buttons */}
        <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={closeGenerator}
            className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            {t("common.close")}
          </button>

          <button
            type="button"
            onClick={() => void handleCopy()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
          >
            <Copy className="h-3.5 w-3.5" />
            {t("generator.copyPassword")}
          </button>

          {callback && (
            <button
              type="button"
              onClick={handleUsePassword}
              className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-500"
            >
              {t("generator.usePassword")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
