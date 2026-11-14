import { create } from "zustand";
import {
  apiDeleteCipher,
  apiDeleteFolder,
  apiPermanentDeleteCipher,
  apiRestoreCipher,
  apiSaveCipher,
  apiSaveFolder,
  apiSyncVault,
} from "../lib/tauri";
import type {
  CipherTypeNumber,
  CipherView,
  FolderView,
  VaultFilter,
  VaultSnapshot,
} from "../types/vault";

export interface ToastMessage {
  id: string;
  text: string;
  variant: "info" | "success" | "error";
}

interface VaultState {
  ciphers: CipherView[];
  folders: FolderView[];
  filter: VaultFilter;
  searchQuery: string;
  selectedCipherId: string | null;
  editingCipher: CipherView | null;
  isCreatingCipher: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  isGeneratorOpen: boolean;
  generatorCallback: ((generatedPassword: string) => void) | null;
  isSettingsOpen: boolean;
  toasts: ToastMessage[];

  setSnapshot: (snapshot: VaultSnapshot) => void;
  clearVaultMemory: () => void;
  setFilter: (filter: VaultFilter) => void;
  setSearchQuery: (query: string) => void;
  selectCipher: (id: string | null) => void;
  startCreateCipher: (defaultType?: CipherTypeNumber) => void;
  startEditCipher: (cipher: CipherView) => void;
  cancelEditCipher: () => void;

  syncVault: () => Promise<void>;
  saveCipher: (cipher: CipherView) => Promise<CipherView>;
  softDeleteCipher: (id: string) => Promise<void>;
  restoreCipher: (id: string) => Promise<void>;
  permanentDeleteCipher: (id: string) => Promise<void>;

  saveFolder: (id: string | null, name: string) => Promise<FolderView>;
  deleteFolder: (id: string) => Promise<void>;

  openGenerator: (onSelect?: (value: string) => void) => void;
  closeGenerator: () => void;
  openSettings: () => void;
  closeSettings: () => void;

  pushToast: (text: string, variant?: "info" | "success" | "error") => void;
  dismissToast: (id: string) => void;
}

export function createBlankCipher(
  cipherType: CipherTypeNumber = 1,
  folderId: string | null = null
): CipherView {
  return {
    id: "",
    organizationId: null,
    folderId,
    type: cipherType,
    name: "",
    notes: "",
    favorite: false,
    login:
      cipherType === 1
        ? {
            username: "",
            password: "",
            totp: "",
            uris: [{ uri: "", match: null }],
          }
        : null,
    card:
      cipherType === 3
        ? {
            cardholderName: "",
            brand: "Visa",
            number: "",
            expMonth: "",
            expYear: "",
            code: "",
          }
        : null,
    identity:
      cipherType === 4
        ? {
            title: "",
            firstName: "",
            middleName: "",
            lastName: "",
            username: "",
            company: "",
            email: "",
            phone: "",
            ssn: "",
            passportNumber: "",
            licenseNumber: "",
            address1: "",
            address2: "",
            city: "",
            state: "",
            postalCode: "",
            country: "",
          }
        : null,
    fields: [],
  };
}

export const useVaultStore = create<VaultState>((set, get) => ({
  ciphers: [],
  folders: [],
  filter: { kind: "all" },
  searchQuery: "",
  selectedCipherId: null,
  editingCipher: null,
  isCreatingCipher: false,
  isSyncing: false,
  lastSyncedAt: null,
  isGeneratorOpen: false,
  generatorCallback: null,
  isSettingsOpen: false,
  toasts: [],

  setSnapshot: (snapshot: VaultSnapshot) => {
    const now = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const firstActive = snapshot.ciphers.find((c) => !c.deletedDate);
    set((state) => ({
      ciphers: snapshot.ciphers,
      folders: snapshot.folders,
      lastSyncedAt: now,
      selectedCipherId:
        state.selectedCipherId &&
        snapshot.ciphers.some((c) => c.id === state.selectedCipherId)
          ? state.selectedCipherId
          : (firstActive?.id ?? null),
    }));
  },

  clearVaultMemory: () => {
    set({
      ciphers: [],
      folders: [],
      selectedCipherId: null,
      editingCipher: null,
      isCreatingCipher: false,
    });
  },

  setFilter: (filter) => {
    set({
      filter,
      editingCipher: null,
      isCreatingCipher: false,
    });
  },

  setSearchQuery: (searchQuery) => {
    set({ searchQuery });
  },

  selectCipher: (id) => {
    set({
      selectedCipherId: id,
      editingCipher: null,
      isCreatingCipher: false,
    });
  },

  startCreateCipher: (defaultType) => {
    const currentFilter = get().filter;
    const inferredType: CipherTypeNumber =
      defaultType ??
      (currentFilter.kind === "type" ? currentFilter.cipherType : 1);
    const inferredFolder =
      currentFilter.kind === "folder" ? currentFilter.folderId : null;

    set({
      isCreatingCipher: true,
      editingCipher: createBlankCipher(inferredType, inferredFolder),
    });
  },

  startEditCipher: (cipher) => {
    set({
      isCreatingCipher: false,
      editingCipher: structuredClone(cipher),
    });
  },

  cancelEditCipher: () => {
    set({
      isCreatingCipher: false,
      editingCipher: null,
    });
  },

  syncVault: async () => {
    set({ isSyncing: true });
    try {
      const snapshot = await apiSyncVault();
      get().setSnapshot(snapshot);
    } finally {
      set({ isSyncing: false });
    }
  },

  saveCipher: async (cipher) => {
    const saved = await apiSaveCipher(cipher);
    set((state) => {
      const exists = state.ciphers.some((c) => c.id === saved.id);
      const updated = exists
        ? state.ciphers.map((c) => (c.id === saved.id ? saved : c))
        : [...state.ciphers, saved];
      updated.sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      );
      return {
        ciphers: updated,
        selectedCipherId: saved.id,
        editingCipher: null,
        isCreatingCipher: false,
      };
    });
    return saved;
  },

  softDeleteCipher: async (id) => {
    const snapshot = await apiDeleteCipher(id);
    get().setSnapshot(snapshot);
    set({ editingCipher: null, isCreatingCipher: false });
  },

  restoreCipher: async (id) => {
    const snapshot = await apiRestoreCipher(id);
    get().setSnapshot(snapshot);
  },

  permanentDeleteCipher: async (id) => {
    await apiPermanentDeleteCipher(id);
    set((state) => {
      const remaining = state.ciphers.filter((c) => c.id !== id);
      return {
        ciphers: remaining,
        selectedCipherId:
          state.selectedCipherId === id
            ? (remaining[0]?.id ?? null)
            : state.selectedCipherId,
      };
    });
  },

  saveFolder: async (id, name) => {
    const saved = await apiSaveFolder(id, name);
    set((state) => {
      const exists = state.folders.some((f) => f.id === saved.id);
      const updated = exists
        ? state.folders.map((f) => (f.id === saved.id ? saved : f))
        : [...state.folders, saved];
      updated.sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      );
      return { folders: updated };
    });
    return saved;
  },

  deleteFolder: async (id) => {
    await apiDeleteFolder(id);
    set((state) => ({
      folders: state.folders.filter((f) => f.id !== id),
      ciphers: state.ciphers.map((c) =>
        c.folderId === id ? { ...c, folderId: null } : c
      ),
      filter:
        state.filter.kind === "folder" && state.filter.folderId === id
          ? { kind: "all" }
          : state.filter,
    }));
  },

  openGenerator: (onSelect) => {
    set({
      isGeneratorOpen: true,
      generatorCallback: onSelect ?? null,
    });
  },

  closeGenerator: () => {
    set({
      isGeneratorOpen: false,
      generatorCallback: null,
    });
  },

  openSettings: () => set({ isSettingsOpen: true }),
  closeSettings: () => set({ isSettingsOpen: false }),

  pushToast: (text, variant = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((state) => ({
      toasts: [...state.toasts, { id, text, variant }],
    }));
    setTimeout(() => {
      get().dismissToast(id);
    }, 3200);
  },

  dismissToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));
