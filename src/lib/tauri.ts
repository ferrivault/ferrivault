import { invoke } from "@tauri-apps/api/core";
import type { AuthStatus, LoginPayload } from "../types/auth";
import type {
  AppSettings,
  TrayMenuLabels,
  UpdateCheckResult,
} from "../types/settings";
import type {
  CipherView,
  FolderView,
  PassphraseGeneratorOptions,
  PasswordGeneratorOptions,
  TotpResponse,
  VaultSnapshot,
} from "../types/vault";

/**
 * Checks whether the app is currently running inside the Tauri v2 runtime.
 */
export function isTauriRuntime(): boolean {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}

// ============================================================================
// Authentication & Session Commands
// ============================================================================

export async function apiLogin(payload: LoginPayload): Promise<VaultSnapshot> {
  return invoke<VaultSnapshot>("login", { payload });
}

export async function apiUnlockVault(
  masterPassword: string
): Promise<VaultSnapshot> {
  return invoke<VaultSnapshot>("unlock_vault", { masterPassword });
}

export async function apiLockVault(): Promise<void> {
  return invoke<void>("lock_vault");
}

export async function apiLogout(): Promise<void> {
  return invoke<void>("logout");
}

export async function apiGetAuthStatus(): Promise<AuthStatus> {
  return invoke<AuthStatus>("get_auth_status");
}

// ============================================================================
// Vault & Folder Commands
// ============================================================================

export async function apiGetVaultSnapshot(): Promise<VaultSnapshot> {
  return invoke<VaultSnapshot>("get_vault_snapshot");
}

export async function apiSyncVault(): Promise<VaultSnapshot> {
  return invoke<VaultSnapshot>("sync_vault");
}

export async function apiSaveCipher(cipher: CipherView): Promise<CipherView> {
  return invoke<CipherView>("save_cipher", { cipher });
}

export async function apiDeleteCipher(id: string): Promise<VaultSnapshot> {
  return invoke<VaultSnapshot>("delete_cipher", { id });
}

export async function apiRestoreCipher(id: string): Promise<VaultSnapshot> {
  return invoke<VaultSnapshot>("restore_cipher", { id });
}

export async function apiPermanentDeleteCipher(id: string): Promise<void> {
  return invoke<void>("permanent_delete_cipher", { id });
}

export async function apiSaveFolder(
  id: string | null,
  name: string
): Promise<FolderView> {
  return invoke<FolderView>("save_folder", { id, name });
}

export async function apiDeleteFolder(id: string): Promise<void> {
  return invoke<void>("delete_folder", { id });
}

// ============================================================================
// Security Tools & Clipboard Commands
// ============================================================================

export async function apiGeneratePassword(
  opts: PasswordGeneratorOptions
): Promise<string> {
  return invoke<string>("generate_password_cmd", { opts });
}

export async function apiGeneratePassphrase(
  opts: PassphraseGeneratorOptions
): Promise<string> {
  return invoke<string>("generate_passphrase_cmd", { opts });
}

export async function apiGenerateTotp(
  secretOrUri: string
): Promise<TotpResponse> {
  return invoke<TotpResponse>("generate_totp_cmd", { secretOrUri });
}

export async function apiCopyToClipboard(text: string): Promise<void> {
  if (!isTauriRuntime()) {
    await navigator.clipboard.writeText(text);
    return;
  }
  return invoke<void>("copy_to_clipboard", { text });
}

export async function apiOpenExternalUrl(uri: string): Promise<void> {
  if (!isTauriRuntime()) {
    window.open(uri, "_blank", "noopener,noreferrer");
    return;
  }
  return invoke<void>("open_external_url", { uri });
}

// ============================================================================
// Settings & Tray Menu Localization Commands
// ============================================================================

export async function apiGetSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("get_settings");
}

export async function apiUpdateSettings(
  newSettings: AppSettings
): Promise<AppSettings> {
  return invoke<AppSettings>("update_settings", { newSettings });
}

export async function apiSyncTrayLocale(labels: TrayMenuLabels): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("sync_tray_locale", { labels });
}

export async function apiCheckForUpdates(): Promise<UpdateCheckResult | null> {
  if (!isTauriRuntime()) return null;
  return invoke<UpdateCheckResult>("check_for_updates");
}
