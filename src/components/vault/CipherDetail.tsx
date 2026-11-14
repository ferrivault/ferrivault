import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Building2Icon,
  CopyIcon,
  ExternalLinkIcon,
  EyeIcon,
  EyeOffIcon,
  FolderIcon,
  RotateCcwIcon,
  ShieldIcon,
  SquarePenIcon,
  StarIcon,
  Trash2Icon,
  UserIcon,
} from "@animateicons/react/lucide";
import { apiCopyToClipboard, apiOpenExternalUrl } from "../../lib/tauri";
import { formatCardNumber, parseBackendError } from "../../lib/utils";
import { useVaultStore } from "../../stores/vaultStore";
import { TotpBadge } from "../tools/TotpBadge";

interface DetailFieldProps {
  label: string;
  value?: string | null;
  secret?: boolean;
  monospace?: boolean;
  externalUri?: boolean;
}

const DetailField: React.FC<DetailFieldProps> = ({
  label,
  value,
  secret = false,
  monospace = false,
  externalUri = false,
}) => {
  const { t } = useTranslation();
  const pushToast = useVaultStore((s) => s.pushToast);
  const [revealed, setRevealed] = useState(!secret);

  if (!value) return null;

  const handleCopy = async () => {
    await apiCopyToClipboard(value);
    pushToast(t("notifications.copied", { field: label }), "success");
  };

  const handleOpen = async () => {
    try {
      await apiOpenExternalUrl(value);
    } catch (err) {
      const parsed = parseBackendError(err);
      pushToast(parsed.message, "error");
    }
  };

  return (
    <div className="group flex items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-slate-900/60 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium text-slate-400">{label}</div>
        <div
          className={`mt-0.5 break-all text-sm text-slate-100 ${
            monospace || secret ? "font-mono" : ""
          }`}
        >
          {secret && !revealed ? "••••••••••••" : value}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {secret && (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            title={revealed ? t("common.hide") : t("common.show")}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            {revealed ? (
              <EyeOffIcon size={16} />
            ) : (
              <EyeIcon size={16} />
            )}
          </button>
        )}

        {externalUri && (
          <button
            type="button"
            onClick={() => void handleOpen()}
            title={t("common.launch")}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-brand-400"
          >
            <ExternalLinkIcon size={16} />
          </button>
        )}

        <button
          type="button"
          onClick={() => void handleCopy()}
          title={t("common.copy")}
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
        >
          <CopyIcon size={16} />
        </button>
      </div>
    </div>
  );
};

export const CipherDetail: React.FC = () => {
  const { t } = useTranslation();
  const ciphers = useVaultStore((s) => s.ciphers);
  const folders = useVaultStore((s) => s.folders);
  const organizations = useVaultStore((s) => s.organizations);
  const selectedCipherId = useVaultStore((s) => s.selectedCipherId);
  const startEditCipher = useVaultStore((s) => s.startEditCipher);
  const softDeleteCipher = useVaultStore((s) => s.softDeleteCipher);
  const restoreCipher = useVaultStore((s) => s.restoreCipher);
  const permanentDeleteCipher = useVaultStore((s) => s.permanentDeleteCipher);
  const pushToast = useVaultStore((s) => s.pushToast);

  const [revealCardNumber, setRevealCardNumber] = useState(false);
  const [confirmingPermDelete, setConfirmingPermDelete] = useState(false);

  const cipher = ciphers.find((c) => c.id === selectedCipherId);

  if (!cipher) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-slate-950 p-8 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-slate-500">
          <ShieldIcon size={24} />
        </div>
        <h3 className="text-sm font-semibold text-slate-300">
          {t("vault.selectItemTitle")}
        </h3>
        <p className="mt-1 max-w-xs text-xs text-slate-500">
          {t("vault.selectItemSubtitle")}
        </p>
      </div>
    );
  }

  const folderName =
    folders.find((f) => f.id === cipher.folderId)?.name ??
    t("sidebar.noFolder");
  const orgName = cipher.organizationId
    ? (organizations.find((o) => o.id === cipher.organizationId)?.name ??
      cipher.organizationId)
    : null;
  const isTrashed = Boolean(cipher.deletedDate);

  const handleSoftDelete = async () => {
    try {
      await softDeleteCipher(cipher.id);
      pushToast(t("notifications.itemDeleted"), "info");
    } catch (err) {
      const parsed = parseBackendError(err);
      pushToast(parsed.message, "error");
    }
  };

  const handleRestore = async () => {
    try {
      await restoreCipher(cipher.id);
      pushToast(t("notifications.itemRestored"), "success");
    } catch (err) {
      const parsed = parseBackendError(err);
      pushToast(parsed.message, "error");
    }
  };

  const handlePermanentDelete = async () => {
    try {
      await permanentDeleteCipher(cipher.id);
      setConfirmingPermDelete(false);
      pushToast(t("notifications.itemPermanentlyDeleted"), "info");
    } catch (err) {
      const parsed = parseBackendError(err);
      pushToast(parsed.message, "error");
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-slate-950 p-6">
      {/* Trash Banner */}
      {isTrashed && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-950/30 px-4 py-2.5 text-xs text-amber-200">
          <span>{t("vault.inTrashBanner")}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex items-start justify-between border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white">{cipher.name}</h2>
            {cipher.favorite && (
              <StarIcon size={16} className="text-amber-400" />
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              {orgName ? (
                <>
                  <Building2Icon size={14} className="text-amber-400" />
                  <span className="text-amber-300">{orgName}</span>
                </>
              ) : (
                <>
                  <UserIcon size={14} className="text-emerald-400" />
                  <span>{t("sidebar.myVault")}</span>
                </>
              )}
            </span>
            <span className="text-slate-700">•</span>
            <span className="flex items-center gap-1.5">
              <FolderIcon size={14} />
              <span>{folderName}</span>
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {!isTrashed ? (
            <>
              <button
                type="button"
                onClick={() => startEditCipher(cipher)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-slate-700"
              >
                <SquarePenIcon size={14} />
                {t("common.edit")}
              </button>

              <button
                type="button"
                onClick={() => void handleSoftDelete()}
                title={t("vault.moveToTrash")}
                className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-900/40"
              >
                <Trash2Icon size={14} />
                {t("common.delete")}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void handleRestore()}
                className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-500"
              >
                <RotateCcwIcon size={14} />
                {t("vault.restoreItem")}
              </button>

              {confirmingPermDelete ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handlePermanentDelete()}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
                  >
                    {t("common.confirm")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingPermDelete(false)}
                    className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300"
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingPermDelete(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-900/50"
                >
                  <Trash2Icon size={14} />
                  {t("vault.permanentDelete")}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Type-Specific Sections */}
      <div className="mt-6 space-y-5">
        {/* 1: LOGIN */}
        {cipher.type === 1 && cipher.login && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {t("vault.login.sectionTitle")}
            </h3>

            <DetailField
              label={t("vault.login.username")}
              value={cipher.login.username}
            />

            <DetailField
              label={t("vault.login.password")}
              value={cipher.login.password}
              secret
              monospace
            />

            {cipher.login.totp && (
              <TotpBadge secretOrUri={cipher.login.totp} />
            )}

            {cipher.login.uris.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {t("vault.login.uris")}
                </div>
                {cipher.login.uris.map((u, idx) => (
                  <DetailField
                    key={idx}
                    label={`${t("vault.login.uris")} #${idx + 1}`}
                    value={u.uri}
                    externalUri
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3: CARD */}
        {cipher.type === 3 && cipher.card && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {t("vault.card.sectionTitle")}
            </h3>

            <DetailField
              label={t("vault.card.cardholderName")}
              value={cipher.card.cardholderName}
            />
            <DetailField
              label={t("vault.card.brand")}
              value={cipher.card.brand}
            />

            {cipher.card.number && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-slate-900/60 px-4 py-3">
                <div>
                  <div className="text-[11px] font-medium text-slate-400">
                    {t("vault.card.number")}
                  </div>
                  <div className="mt-0.5 font-mono text-sm text-slate-100">
                    {formatCardNumber(cipher.card.number, !revealCardNumber)}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setRevealCardNumber((v) => !v)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                  >
                    {revealCardNumber ? (
                      <EyeOffIcon size={16} />
                    ) : (
                      <EyeIcon size={16} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (cipher.card?.number) {
                        void apiCopyToClipboard(
                          cipher.card.number.replace(/\s+/g, "")
                        );
                        pushToast(
                          t("notifications.copied", {
                            field: t("vault.card.number"),
                          }),
                          "success"
                        );
                      }
                    }}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                  >
                    <CopyIcon size={16} />
                  </button>
                </div>
              </div>
            )}

            {(cipher.card.expMonth || cipher.card.expYear) && (
              <DetailField
                label={t("vault.card.expiration")}
                value={`${cipher.card.expMonth ?? "--"} / ${
                  cipher.card.expYear ?? "----"
                }`}
                monospace
              />
            )}

            <DetailField
              label={t("vault.card.securityCode")}
              value={cipher.card.code}
              secret
              monospace
            />
          </div>
        )}

        {/* 4: IDENTITY */}
        {cipher.type === 4 && cipher.identity && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {t("vault.identity.sectionTitle")}
            </h3>

            <DetailField
              label={t("vault.identity.firstName")}
              value={[
                cipher.identity.title,
                cipher.identity.firstName,
                cipher.identity.middleName,
                cipher.identity.lastName,
              ]
                .filter(Boolean)
                .join(" ")}
            />
            <DetailField
              label={t("vault.identity.username")}
              value={cipher.identity.username}
            />
            <DetailField
              label={t("vault.identity.company")}
              value={cipher.identity.company}
            />
            <DetailField
              label={t("vault.identity.email")}
              value={cipher.identity.email}
            />
            <DetailField
              label={t("vault.identity.phone")}
              value={cipher.identity.phone}
            />
            <DetailField
              label={t("vault.identity.ssn")}
              value={cipher.identity.ssn}
              secret
            />
            <DetailField
              label={t("vault.identity.passportNumber")}
              value={cipher.identity.passportNumber}
              secret
            />
            <DetailField
              label={t("vault.identity.licenseNumber")}
              value={cipher.identity.licenseNumber}
            />
            <DetailField
              label={t("vault.identity.address1")}
              value={[
                cipher.identity.address1,
                cipher.identity.address2,
                cipher.identity.city,
                cipher.identity.state,
                cipher.identity.postalCode,
                cipher.identity.country,
              ]
                .filter(Boolean)
                .join(", ")}
            />
          </div>
        )}

        {/* Notes */}
        {cipher.notes && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {t("vault.notes")}
            </h3>
            <div className="whitespace-pre-wrap rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 text-xs leading-relaxed text-slate-200">
              {cipher.notes}
            </div>
          </div>
        )}

        {/* Custom Fields */}
        {cipher.fields.length > 0 && (
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {t("vault.customFields")}
            </h3>
            {cipher.fields.map((f, idx) => (
              <DetailField
                key={idx}
                label={f.name}
                value={f.value}
                secret={f.type === 1}
              />
            ))}
          </div>
        )}

        {/* Timestamps */}
        {cipher.revisionDate && (
          <div className="border-t border-slate-800/60 pt-4 text-[11px] text-slate-500">
            {t("vault.timestamps.updated", {
              date: new Date(cipher.revisionDate).toLocaleString(),
            })}
          </div>
        )}
      </div>
    </div>
  );
};
