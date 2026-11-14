//! Thread-safe application state holding active session metadata, zeroizable
//! cryptographic keys, encrypted vault cache, and user preferences.

use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::api::{endpoints::ServerEndpoints, sync::SyncResponse};
use crate::crypto::{kdf::KdfParams, keys::SymmetricCryptoKey};
use crate::models::{cipher::CipherView, folder::FolderView};

/// User preferences managed in backend state.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    /// Active UI language code (`"en"`, `"es"`, `"ca"`, etc.).
    pub locale: String,
    /// Seconds before automatically clearing copied secrets from the OS clipboard (`0` = never).
    pub clipboard_clear_seconds: u64,
    /// Minutes of inactivity before locking the vault (`0` = never).
    pub auto_lock_minutes: u64,
    /// Whether closing the main window minimizes Rustwarden to the system tray instead of quitting.
    pub close_to_tray: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            locale: "en".to_string(),
            clipboard_clear_seconds: 30,
            auto_lock_minutes: 15,
            close_to_tray: true,
        }
    }
}

/// Organization vault summary exposed to the React frontend.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrganizationView {
    pub id: String,
    pub name: String,
}

/// Complete decrypted vault snapshot sent to the React frontend.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultSnapshot {
    pub email: String,
    pub server_url: String,
    pub ciphers: Vec<CipherView>,
    pub folders: Vec<FolderView>,
    pub organizations: Vec<OrganizationView>,
}

/// Session state that survives locking (encrypted tokens & KDF params),
/// while `vault_key` and `decrypted_snapshot` are wiped (`None`) whenever locked.
pub struct SessionData {
    pub email: String,
    pub endpoints: ServerEndpoints,
    pub kdf_params: KdfParams,
    pub access_token: String,
    pub refresh_token: Option<String>,
    /// Encrypted user symmetric key (`EncString`), retained while locked so the user can
    /// unlock offline with their Master Password without re-authenticating unless needed.
    pub protected_symmetric_key: String,
    /// Last synced encrypted response so unlocking can re-decrypt immediately.
    pub last_encrypted_sync: Option<SyncResponse>,
    /// Active 64-byte vault `SymmetricCryptoKey` (wiped via `ZeroizeOnDrop` when locked).
    pub vault_key: Option<SymmetricCryptoKey>,
    /// Cached decrypted vault items (cleared when locked).
    pub decrypted_snapshot: Option<VaultSnapshot>,
}

impl SessionData {
    /// Locks the session by dropping the `SymmetricCryptoKey` (which zeroizes its bytes)
    /// and clearing the decrypted vault snapshot from memory.
    pub fn lock(&mut self) {
        self.vault_key = None;
        self.decrypted_snapshot = None;
    }
}

/// Authentication status summary returned to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthStatus {
    pub is_logged_in: bool,
    pub is_locked: bool,
    pub email: Option<String>,
    pub server_url: Option<String>,
}

/// Global Tauri-managed state.
pub struct AppState {
    pub http_client: Client,
    pub device_id: String,
    pub session: RwLock<Option<SessionData>>,
    pub settings: RwLock<AppSettings>,
    /// Atomic flag mirrored from `settings.close_to_tray` for synchronous window close interception.
    pub close_to_tray_enabled: AtomicBool,
}

impl AppState {
    /// Initializes a fresh `AppState` with a shared rustls `reqwest::Client`.
    pub fn new() -> Self {
        let mut default_headers = reqwest::header::HeaderMap::new();
        default_headers.insert(
            "Bitwarden-Client-Name",
            reqwest::header::HeaderValue::from_static("desktop"),
        );
        default_headers.insert(
            "Bitwarden-Client-Version",
            reqwest::header::HeaderValue::from_static("2026.10.0"),
        );
        default_headers.insert(
            "Device-Type",
            reqwest::header::HeaderValue::from_static("8"),
        );

        let http_client = Client::builder()
            .user_agent("Mozilla/5.0 (X11; Linux x86_64) Bitwarden/2026.10.0")
            .default_headers(default_headers)
            .build()
            .unwrap_or_else(|_| Client::new());

        Self {
            http_client,
            device_id: Uuid::new_v4().to_string(),
            session: RwLock::new(None),
            settings: RwLock::new(AppSettings::default()),
            close_to_tray_enabled: AtomicBool::new(true),
        }
    }

    /// Returns whether close-to-tray is currently enabled.
    pub fn should_close_to_tray(&self) -> bool {
        self.close_to_tray_enabled.load(Ordering::Relaxed)
    }

    /// Updates the atomic close-to-tray flag.
    pub fn set_close_to_tray(&self, enabled: bool) {
        self.close_to_tray_enabled.store(enabled, Ordering::Relaxed);
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
