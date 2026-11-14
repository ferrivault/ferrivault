import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Check, ShieldAlert, Clock } from "lucide-react";
import { apiCopyToClipboard, apiGenerateTotp } from "../../lib/tauri";
import { useVaultStore } from "../../stores/vaultStore";
import type { TotpResponse } from "../../types/vault";

interface TotpBadgeProps {
  secretOrUri: string;
}

export const TotpBadge: React.FC<TotpBadgeProps> = ({ secretOrUri }) => {
  const { t } = useTranslation();
  const pushToast = useVaultStore((s) => s.pushToast);

  const [totp, setTotp] = useState<TotpResponse | null>(null);
  const [hasError, setHasError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;

    const refreshCode = async () => {
      try {
        const res = await apiGenerateTotp(secretOrUri);
        if (active) {
          setTotp(res);
          setHasError(false);
        }
      } catch {
        if (active) {
          setHasError(true);
        }
      }
    };

    void refreshCode();
    const interval = setInterval(() => {
      void refreshCode();
    }, 1000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [secretOrUri]);

  const handleCopy = async () => {
    if (!totp) return;
    await apiCopyToClipboard(totp.code);
    setCopied(true);
    pushToast(
      t("notifications.copied", { field: t("vault.login.totpCode") }),
      "success"
    );
    setTimeout(() => setCopied(false), 1500);
  };

  if (hasError) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <span>{t("errors.cryptoError")}</span>
      </div>
    );
  }

  if (!totp) {
    return null;
  }

  const formattedCode =
    totp.code.length === 6
      ? `${totp.code.slice(0, 3)} ${totp.code.slice(3)}`
      : totp.code;

  const isExpiringSoon = totp.remainingSeconds <= 5;
  const progressPercent = Math.round(
    (totp.remainingSeconds / totp.period) * 100
  );

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3.5">
      <div className="flex items-center justify-between">
        <div>
          <span className="block text-[11px] font-medium uppercase tracking-wider text-slate-400">
            {t("vault.login.totpCode")}
          </span>
          <span
            className={`mt-0.5 block font-mono text-2xl font-bold tracking-widest ${
              isExpiringSoon ? "text-amber-400" : "text-brand-400"
            }`}
          >
            {formattedCode}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Clock
              className={`h-3.5 w-3.5 ${
                isExpiringSoon ? "text-amber-400" : "text-slate-400"
              }`}
            />
            <span>
              {t("vault.login.totpExpiresIn", {
                seconds: totp.remainingSeconds,
              })}
            </span>
          </div>

          <button
            type="button"
            onClick={() => void handleCopy()}
            title={t("common.copy")}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700 hover:text-white"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {t("common.copy")}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full transition-all duration-500 ${
            isExpiringSoon ? "bg-amber-400" : "bg-brand-500"
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
};
