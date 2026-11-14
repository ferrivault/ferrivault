import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Building2Icon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CreditCardIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
  GlobeIcon,
  KeyRoundIcon,
  LayersIcon,
  LockIcon,
  LogOutIcon,
  PlusIcon,
  RefreshCwIcon,
  SettingsIcon,
  ShieldCheckIcon,
  StarIcon,
  Trash2Icon,
  UserCheckIcon,
  UserIcon,
  VaultIcon,
  XIcon,
} from "@animateicons/react/lucide";
import { parseBackendError } from "../../lib/utils";
import { useAuthStore } from "../../stores/authStore";
import { useVaultStore } from "../../stores/vaultStore";
import {
  isCipherInVaultScope,
  type FolderView,
  type VaultFilter,
  type VaultScope,
} from "../../types/vault";
import { ConfirmDialog } from "../ui/ConfirmDialog";

export const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const auth = useAuthStore();
  const ciphers = useVaultStore((s) => s.ciphers);
  const folders = useVaultStore((s) => s.folders);
  const organizations = useVaultStore((s) => s.organizations);
  const collections = useVaultStore((s) => s.collections);
  const vaultScope = useVaultStore((s) => s.vaultScope);
  const setVaultScope = useVaultStore((s) => s.setVaultScope);
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
  const [isVaultTreeOpen, setIsVaultTreeOpen] = useState(true);
  const [pendingDeleteFolder, setPendingDeleteFolder] =
    useState<FolderView | null>(null);
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);

  const allActiveCiphers = ciphers.filter((c) => !c.deletedDate);
  const scopedCiphers = ciphers.filter((c) =>
    isCipherInVaultScope(c, vaultScope)
  );
  const activeCiphers = scopedCiphers.filter((c) => !c.deletedDate);
  const trashCount = scopedCiphers.filter((c) => Boolean(c.deletedDate)).length;
  const favCount = activeCiphers.filter((c) => c.favorite).length;

  const visibleFolders = folders.filter((folder) => {
    if (vaultScope.kind === "all") return true;
    const countInScope = activeCiphers.filter(
      (c) => c.folderId === folder.id
    ).length;
    if (countInScope > 0) return true;
    // Keep newly created empty folders visible in My Vault if they have no items in any vault
    if (vaultScope.kind === "myVault") {
      const countAcrossAllVaults = allActiveCiphers.filter(
        (c) => c.folderId === folder.id
      ).length;
      return countAcrossAllVaults === 0;
    }
    return false;
  });

  const visibleCollections = collections.filter((col) => {
    if (vaultScope.kind === "all") return true;
    if (vaultScope.kind === "organization") {
      return col.organizationId === vaultScope.organizationId;
    }
    return false;
  });

  const isScopeSelected = (candidate: VaultScope): boolean => {
    if (vaultScope.kind !== candidate.kind) return false;
    if (
      vaultScope.kind === "organization" &&
      candidate.kind === "organization"
    ) {
      return vaultScope.organizationId === candidate.organizationId;
    }
    return true;
  };

  const isSelected = (candidate: VaultFilter): boolean => {
    if (filter.kind !== candidate.kind) return false;
    if (filter.kind === "type" && candidate.kind === "type") {
      return filter.cipherType === candidate.cipherType;
    }
    if (filter.kind === "folder" && candidate.kind === "folder") {
      return filter.folderId === candidate.folderId;
    }
    if (filter.kind === "collection" && candidate.kind === "collection") {
      return filter.collectionId === candidate.collectionId;
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

  const requestDeleteFolder = (folder: FolderView, e: React.MouseEvent) => {
    e.stopPropagation();
    setPendingDeleteFolder(folder);
  };

  const confirmDeleteFolder = async () => {
    if (!pendingDeleteFolder) return;
    setIsDeletingFolder(true);
    try {
      await deleteFolder(pendingDeleteFolder.id);
      setPendingDeleteFolder(null);
      pushToast(t("notifications.folderDeleted"), "info");
    } catch (err) {
      const parsed = parseBackendError(err);
      pushToast(parsed.message, "error");
    } finally {
      setIsDeletingFolder(false);
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
            <ShieldCheckIcon size={16} />
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
        {/* Vaults Tree Selector */}
        <div>
          <div className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {t("sidebar.vaultsHeader")}
          </div>

          <div className="space-y-1">
            {/* Root Node: All Vaults */}
            <div
              className={`flex items-center justify-between rounded-lg px-2 py-1.5 font-medium transition ${
                isScopeSelected({ kind: "all" })
                  ? "bg-brand-600/20 text-brand-300"
                  : "text-slate-300 hover:bg-slate-800/60"
              }`}
            >
              <div className="flex min-w-0 flex-1 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsVaultTreeOpen((v) => !v)}
                  className="rounded p-0.5 text-slate-400 hover:bg-slate-700/60 hover:text-white"
                >
                  {isVaultTreeOpen ? (
                    <ChevronDownIcon size={14} />
                  ) : (
                    <ChevronRightIcon size={14} />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setVaultScope({ kind: "all" })}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <VaultIcon size={15} className="shrink-0 text-brand-400" />
                  <span className="truncate">{t("sidebar.allVaults")}</span>
                </button>
              </div>
              <span className="ml-1 text-[10px] text-slate-500">
                {allActiveCiphers.length}
              </span>
            </div>

            {/* Child Nodes: My Vault + Organization Vaults */}
            {isVaultTreeOpen && (
              <div className="ml-3.5 space-y-1 border-l border-slate-800 pl-2.5">
                <button
                  type="button"
                  onClick={() => setVaultScope({ kind: "myVault" })}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 font-medium transition ${
                    isScopeSelected({ kind: "myVault" })
                      ? "bg-brand-600/20 text-brand-300"
                      : "text-slate-300 hover:bg-slate-800/60"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2 truncate">
                    <UserIcon size={14} className="shrink-0 text-emerald-400" />
                    <span className="truncate">{t("sidebar.myVault")}</span>
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {allActiveCiphers.filter((c) => !c.organizationId).length}
                  </span>
                </button>

                {organizations.map((org) => {
                  const orgCount = allActiveCiphers.filter(
                    (c) => c.organizationId === org.id
                  ).length;
                  return (
                    <button
                      key={org.id}
                      type="button"
                      onClick={() =>
                        setVaultScope({
                          kind: "organization",
                          organizationId: org.id,
                        })
                      }
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 font-medium transition ${
                        isScopeSelected({
                          kind: "organization",
                          organizationId: org.id,
                        })
                          ? "bg-brand-600/20 text-brand-300"
                          : "text-slate-300 hover:bg-slate-800/60"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2 truncate">
                        <Building2Icon
                          size={14}
                          className="shrink-0 text-amber-400"
                        />
                        <span className="truncate">{org.name}</span>
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {orgCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

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
              <LayersIcon size={16} />
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
              <StarIcon size={16} className="text-amber-400" />
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
              <Trash2Icon size={16} className="text-red-400" />
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
                { type: 1, label: t("sidebar.typeLogin"), Icon: GlobeIcon },
                { type: 2, label: t("sidebar.typeNote"), Icon: FileTextIcon },
                { type: 3, label: t("sidebar.typeCard"), Icon: CreditCardIcon },
                {
                  type: 4,
                  label: t("sidebar.typeIdentity"),
                  Icon: UserCheckIcon,
                },
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
                    <Icon size={16} className="text-slate-400" />
                    {label}
                  </span>
                  <span className="text-[10px] text-slate-500">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Organization Collections */}
        {visibleCollections.length > 0 && (
          <div>
            <div className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {t("sidebar.collectionsHeader")}
            </div>
            <div className="space-y-1">
              {visibleCollections.map((col) => {
                const count = activeCiphers.filter((c) =>
                  c.collectionIds.includes(col.id)
                ).length;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() =>
                      setFilter({ kind: "collection", collectionId: col.id })
                    }
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 font-medium transition ${
                      isSelected({ kind: "collection", collectionId: col.id })
                        ? "bg-brand-600/20 text-brand-300"
                        : "text-slate-300 hover:bg-slate-800/60"
                    }`}
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      <Building2Icon
                        size={15}
                        className="shrink-0 text-amber-400"
                      />
                      <span className="truncate">{col.name}</span>
                    </span>
                    <span className="text-[10px] text-slate-500">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

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
              <PlusIcon size={14} />
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
                <CheckIcon size={14} />
              </button>
              <button
                type="button"
                onClick={() => setIsAddingFolder(false)}
                className="rounded bg-slate-800 p-1 text-slate-400 hover:text-white"
              >
                <XIcon size={14} />
              </button>
            </form>
          )}

          <div className="space-y-1">
            {visibleFolders.map((folder) => {
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
                    <FolderIcon size={16} className="shrink-0 text-slate-400" />
                    <span className="truncate">{folder.name}</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-500">{count}</span>
                    <button
                      type="button"
                      onClick={(e) => requestDeleteFolder(folder, e)}
                      title={t("sidebar.deleteFolder")}
                      className="hidden rounded p-0.5 text-slate-500 hover:text-red-400 group-hover:inline-block"
                    >
                      <Trash2Icon size={12} />
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
                <FolderOpenIcon size={16} className="text-slate-500" />
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
              <KeyRoundIcon size={16} className="text-brand-400" />
              {t("sidebar.passwordGenerator")}
            </button>

            <button
              type="button"
              onClick={() => void handleSync()}
              disabled={isSyncing}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 font-medium text-slate-300 transition hover:bg-slate-800/60 disabled:opacity-50"
            >
              <RefreshCwIcon
                size={16}
                className={
                  isSyncing ? "animate-spin text-brand-400" : "text-slate-400"
                }
              />
              {isSyncing ? t("sidebar.syncing") : t("sidebar.syncVault")}
            </button>

            <button
              type="button"
              onClick={openSettings}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 font-medium text-slate-300 transition hover:bg-slate-800/60"
            >
              <SettingsIcon size={16} className="text-slate-400" />
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
          <LockIcon size={14} className="text-amber-400" />
          {t("auth.lockButton")}
        </button>

        <button
          type="button"
          onClick={() => void handleLogout()}
          title={t("auth.logoutButton")}
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-red-400"
        >
          <LogOutIcon size={16} />
        </button>
      </div>

      <ConfirmDialog
        isOpen={Boolean(pendingDeleteFolder)}
        title={t("sidebar.deleteFolderTitle")}
        description={t("sidebar.deleteFolderConfirm", {
          name: pendingDeleteFolder?.name ?? "",
        })}
        warningText={
          pendingDeleteFolder
            ? (() => {
                const folderItemCount = ciphers.filter(
                  (c) =>
                    !c.deletedDate && c.folderId === pendingDeleteFolder.id
                ).length;
                return folderItemCount > 0
                  ? t("sidebar.deleteFolderNonEmptyWarning", {
                      count: folderItemCount,
                    })
                  : null;
              })()
            : null
        }
        confirmLabel={t("common.delete")}
        isLoading={isDeletingFolder}
        onConfirm={() => void confirmDeleteFolder()}
        onCancel={() => setPendingDeleteFolder(null)}
      />
    </aside>
  );
};
