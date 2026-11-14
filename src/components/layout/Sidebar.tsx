import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CreditCard,
  FileText,
  Folder,
  FolderOpen,
  Globe,
  KeyRound,
  Layers,
  Lock,
  LogOut,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  Star,
  Trash2,
  UserCheck,
  Check,
  X,
} from "lucide-react";
import { parseBackendError } from "../../lib/utils";
import { useAuthStore } from "../../stores/authStore";
import { useVaultStore } from "../../stores/vaultStore";
import type { VaultFilter } from "../../types/vault";

export const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const auth = useAuthStore();
  const ciphers = useVaultStore((s) => s.ciphers);
  const folders = useVaultStore((s) => s.folders);
  const filter = useVaultStore((s) => s.filter);
  const setFilter = useVaultStore((s) => s.setFilter);
  const isSyncing = useVaultStore((s) => s.isSyncing);
  const syncVault = useVaultStore((s) => s.syncVault);
  const saveFolder = useVaultStore((s) => s.saveFolder);
  const deleteFolder = useVaultStore((s) => s.deleteFolder);
  const openGenerator = useVaultStore((s) => s.openGenerator);
  const openSettings = useVaultStore((s) => s.openSettings);
  const clearVaultMemory = useVaultStore((s) => s.clearVaultMemory);
  const pushToast = useVaultStore((s) => s.pushToast);

  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const activeCiphers = ciphers.filter((c) => !c.deletedDate);
  const trashCount = ciphers.filter((c) => Boolean(c.deletedDate)).length;
  const favCount = activeCiphers.filter((c) => c.favorite).length;

  const isSelected = (candidate: VaultFilter): boolean => {
    if (filter.kind !== candidate.kind) return false;
    if (filter.kind === "type" && candidate.kind === "type") {
      return filter.cipherType === candidate.cipherType;
    }
    if (filter.kind === "folder" && candidate.kind === "folder") {
      return filter.folderId === candidate.folderId;
    }
    return true;
  };

  const handleSync = async () => {
    try {
      await syncVault();
      pushToast(t("notifications.syncSuccess"), "success");
    } catch (err) {
      const parsed = parseBackendError(err);
      pushToast(
        t(parsed.errorKey, {
          message: parsed.message,
          defaultValue: parsed.message,
        }),
        "error"
      );
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      await saveFolder(null, newFolderName.trim());
      setNewFolderName("");
      setIsAddingFolder(false);
      pushToast(t("notifications.folderSaved"), "success");
    } catch (err) {
      const parsed = parseBackendError(err);
      pushToast(parsed.message, "error");
    }
  };

  const handleDeleteFolder = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteFolder(id);
      pushToast(t("notifications.folderDeleted"), "info");
    } catch (err) {
      const parsed = parseBackendError(err);
      pushToast(parsed.message, "error");
    }
  };

  const handleLock = async () => {
    clearVaultMemory();
    await auth.lock();
    pushToast(t("notifications.vaultLocked"), "info");
  };

  const handleLogout = async () => {
    clearVaultMemory();
    await auth.logout();
  };

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-slate-800/80 bg-slate-900/70 select-none">
      {/* Brand Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-3.5">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white shadow">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="truncate">
            <div className="text-sm font-bold text-white">{t("app.name")}</div>
            <div className="truncate text-[11px] text-slate-400">
              {auth.email}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4 text-xs">
        {/* Primary Views */}
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setFilter({ kind: "all" })}
            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 font-medium transition ${
              isSelected({ kind: "all" })
                ? "bg-brand-600/20 text-brand-300"
                : "text-slate-300 hover:bg-slate-800/60"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Layers className="h-4 w-4" />
              {t("sidebar.allItems")}
            </span>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
              {activeCiphers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilter({ kind: "favorites" })}
            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 font-medium transition ${
              isSelected({ kind: "favorites" })
                ? "bg-brand-600/20 text-brand-300"
                : "text-slate-300 hover:bg-slate-800/60"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Star className="h-4 w-4 text-amber-400" />
              {t("sidebar.favorites")}
            </span>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
              {favCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilter({ kind: "trash" })}
            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 font-medium transition ${
              isSelected({ kind: "trash" })
                ? "bg-red-500/20 text-red-300"
                : "text-slate-300 hover:bg-slate-800/60"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Trash2 className="h-4 w-4 text-red-400" />
              {t("sidebar.trash")}
            </span>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
              {trashCount}
            </span>
          </button>
        </div>

        {/* Cipher Types */}
        <div>
          <div className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {t("sidebar.typesHeader")}
          </div>
          <div className="space-y-1">
            {(
              [
                { type: 1, label: t("sidebar.typeLogin"), Icon: Globe },
                { type: 2, label: t("sidebar.typeNote"), Icon: FileText },
                { type: 3, label: t("sidebar.typeCard"), Icon: CreditCard },
                { type: 4, label: t("sidebar.typeIdentity"), Icon: UserCheck },
              ] as const
            ).map(({ type, label, Icon }) => {
              const count = activeCiphers.filter((c) => c.type === type).length;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() =>
                    setFilter({ kind: "type", cipherType: type })
                  }
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 font-medium transition ${
                    isSelected({ kind: "type", cipherType: type })
                      ? "bg-brand-600/20 text-brand-300"
                      : "text-slate-300 hover:bg-slate-800/60"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 text-slate-400" />
                    {label}
                  </span>
                  <span className="text-[10px] text-slate-500">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Folders */}
        <div>
          <div className="mb-1.5 flex items-center justify-between px-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {t("sidebar.foldersHeader")}
            </span>
            <button
              type="button"
              onClick={() => setIsAddingFolder((v) => !v)}
              title={t("sidebar.addFolder")}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {isAddingFolder && (
            <form
              onSubmit={(e) => void handleCreateFolder(e)}
              className="mb-2 flex items-center gap-1 px-1"
            >
              <input
                type="text"
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder={t("sidebar.folderNamePlaceholder")}
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 focus:border-brand-500 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded bg-brand-600 p-1 text-white hover:bg-brand-500"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsAddingFolder(false)}
                className="rounded bg-slate-800 p-1 text-slate-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </form>
          )}

          <div className="space-y-1">
            {folders.map((folder) => {
              const count = activeCiphers.filter(
                (c) => c.folderId === folder.id
              ).length;
              return (
                <div
                  key={folder.id}
                  onClick={() =>
                    setFilter({ kind: "folder", folderId: folder.id })
                  }
                  className={`group flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 font-medium transition ${
                    isSelected({ kind: "folder", folderId: folder.id })
                      ? "bg-brand-600/20 text-brand-300"
                      : "text-slate-300 hover:bg-slate-800/60"
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Folder className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="truncate">{folder.name}</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-500">{count}</span>
                    <button
                      type="button"
                      onClick={(e) => void handleDeleteFolder(folder.id, e)}
                      title={t("sidebar.deleteFolder")}
                      className="hidden rounded p-0.5 text-slate-500 hover:text-red-400 group-hover:inline-block"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* No Folder */}
            <button
              type="button"
              onClick={() => setFilter({ kind: "folder", folderId: null })}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 font-medium transition ${
                isSelected({ kind: "folder", folderId: null })
                  ? "bg-brand-600/20 text-brand-300"
                  : "text-slate-400 hover:bg-slate-800/60"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <FolderOpen className="h-4 w-4 text-slate-500" />
                {t("sidebar.noFolder")}
              </span>
              <span className="text-[10px] text-slate-500">
                {activeCiphers.filter((c) => !c.folderId).length}
              </span>
            </button>
          </div>
        </div>

        {/* Tools */}
        <div>
          <div className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {t("sidebar.toolsHeader")}
          </div>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => openGenerator()}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 font-medium text-slate-300 transition hover:bg-slate-800/60"
            >
              <KeyRound className="h-4 w-4 text-brand-400" />
              {t("sidebar.passwordGenerator")}
            </button>

            <button
              type="button"
              onClick={() => void handleSync()}
              disabled={isSyncing}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 font-medium text-slate-300 transition hover:bg-slate-800/60 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 text-slate-400 ${
                  isSyncing ? "animate-spin text-brand-400" : ""
                }`}
              />
              {isSyncing ? t("sidebar.syncing") : t("sidebar.syncVault")}
            </button>

            <button
              type="button"
              onClick={openSettings}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 font-medium text-slate-300 transition hover:bg-slate-800/60"
            >
              <Settings className="h-4 w-4 text-slate-400" />
              {t("sidebar.settings")}
            </button>
          </div>
        </div>
      </div>

      {/* Footer Lock & Logout Controls */}
      <div className="flex items-center justify-between border-t border-slate-800/80 px-3 py-2.5 text-xs">
        <button
          type="button"
          onClick={() => void handleLock()}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
        >
          <Lock className="h-3.5 w-3.5 text-amber-400" />
          {t("auth.lockButton")}
        </button>

        <button
          type="button"
          onClick={() => void handleLogout()}
          title={t("auth.logoutButton")}
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-red-400"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
};
