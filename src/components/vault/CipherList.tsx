import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  PlusIcon,
  SearchIcon,
  StarIcon,
  XIcon,
} from "@animateicons/react/lucide";
import { extractHostname } from "../../lib/utils";
import { useVaultStore } from "../../stores/vaultStore";
import { isCipherInVaultScope, type CipherView } from "../../types/vault";
import { CipherIcon } from "./CipherIcon";

export const CipherList: React.FC = () => {
  const { t } = useTranslation();
  const ciphers = useVaultStore((s) => s.ciphers);
  const organizations = useVaultStore((s) => s.organizations);
  const vaultScope = useVaultStore((s) => s.vaultScope);
  const filter = useVaultStore((s) => s.filter);
  const searchQuery = useVaultStore((s) => s.searchQuery);
  const setSearchQuery = useVaultStore((s) => s.setSearchQuery);
  const selectedCipherId = useVaultStore((s) => s.selectedCipherId);
  const selectCipher = useVaultStore((s) => s.selectCipher);
  const startCreateCipher = useVaultStore((s) => s.startCreateCipher);

  const filteredCiphers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return ciphers.filter((cipher) => {
      if (!isCipherInVaultScope(cipher, vaultScope)) return false;

      const isTrashed = Boolean(cipher.deletedDate);

      if (filter.kind === "trash") {
        if (!isTrashed) return false;
      } else {
        if (isTrashed) return false;
        if (filter.kind === "favorites" && !cipher.favorite) return false;
        if (filter.kind === "type" && cipher.type !== filter.cipherType)
          return false;
        if (filter.kind === "folder") {
          const cid = cipher.folderId ?? null;
          if (cid !== filter.folderId) return false;
        }
        if (filter.kind === "collection") {
          if (!cipher.collectionIds.includes(filter.collectionId)) return false;
        }
      }

      if (!q) return true;

      const nameMatch = cipher.name.toLowerCase().includes(q);
      const userMatch =
        cipher.login?.username?.toLowerCase().includes(q) ?? false;
      const uriMatch =
        cipher.login?.uris.some((u) => u.uri.toLowerCase().includes(q)) ??
        false;
      const cardMatch =
        cipher.card?.cardholderName?.toLowerCase().includes(q) ?? false;
      const notesMatch = cipher.notes?.toLowerCase().includes(q) ?? false;

      return nameMatch || userMatch || uriMatch || cardMatch || notesMatch;
    });
  }, [ciphers, vaultScope, filter, searchQuery]);

  const getSecondaryText = (cipher: CipherView): string => {
    if (cipher.type === 1) {
      if (cipher.login?.username) return cipher.login.username;
      const firstUri = cipher.login?.uris[0]?.uri;
      return extractHostname(firstUri) ?? "";
    }
    if (cipher.type === 3) {
      const brand = cipher.card?.brand ?? "";
      const last4 = cipher.card?.number?.replace(/\s+/g, "").slice(-4);
      return last4 ? `${brand} •••• ${last4}`.trim() : brand;
    }
    if (cipher.type === 4) {
      const full = [cipher.identity?.firstName, cipher.identity?.lastName]
        .filter(Boolean)
        .join(" ");
      return full || (cipher.identity?.email ?? "");
    }
    return cipher.notes?.slice(0, 48) ?? "";
  };

  return (
    <section className="flex h-full w-80 shrink-0 flex-col border-r border-slate-800/80 bg-slate-950/60">
      {/* Search & New Button Header */}
      <div className="flex items-center gap-2 border-b border-slate-800/80 p-3">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute left-2.5 top-2 text-slate-500">
            <SearchIcon size={14} />
          </div>
          <input
            id="vault-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("common.searchPlaceholder")}
            className="w-full rounded-lg border border-slate-800 bg-slate-900 py-1.5 pl-8 pr-7 text-xs text-slate-100 placeholder-slate-500 focus:border-brand-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-2 text-slate-500 hover:text-slate-300"
            >
              <XIcon size={14} />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => startCreateCipher()}
          title={t("vault.newItem")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white shadow transition hover:bg-brand-500"
        >
          <PlusIcon size={16} />
        </button>
      </div>

      {/* Items List */}
      <div className="flex-1 divide-y divide-slate-800/40 overflow-y-auto">
        {filteredCiphers.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center">
            <p className="text-xs font-semibold text-slate-300">
              {t("vault.emptyListTitle")}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              {t("vault.emptyListSubtitle")}
            </p>
          </div>
        ) : (
          filteredCiphers.map((cipher) => {
            const selected = cipher.id === selectedCipherId;
            const subtitle = getSecondaryText(cipher);
            const orgName = cipher.organizationId
              ? organizations.find((o) => o.id === cipher.organizationId)?.name
              : null;

            return (
              <button
                key={cipher.id}
                type="button"
                onClick={() => selectCipher(cipher.id)}
                className={`flex w-full items-center gap-3 px-3.5 py-3 text-left transition ${
                  selected
                    ? "bg-brand-600/15 border-l-2 border-l-brand-500"
                    : "hover:bg-slate-900/70"
                }`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900">
                  <CipherIcon cipher={cipher} size={18} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-semibold text-slate-100">
                      {cipher.name}
                    </span>
                    {cipher.favorite && (
                      <StarIcon
                        size={12}
                        className="shrink-0 text-amber-400"
                      />
                    )}
                    {orgName && (
                      <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-medium text-amber-300">
                        {orgName}
                      </span>
                    )}
                  </div>
                  {subtitle && (
                    <div className="mt-0.5 truncate text-[11px] text-slate-400">
                      {subtitle}
                    </div>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
};
