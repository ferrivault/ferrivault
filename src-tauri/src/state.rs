//! Thread-safe application state holding active session metadata, zeroizable
//! cryptographic keys, encrypted vault cache, and user preferences.

use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
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

/// Encrypted session metadata persisted on disk so the device stays registered
/// and a locked session survives application restarts (plaintext keys are NEVER stored).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersistedSession {
    pub email: String,
    pub endpoints: ServerEndpoints,
    pub kdf_params: KdfParams,
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub protected_symmetric_key: String,
}

/// On-disk state persisted in `~/.config/rustwarden/state.json`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersistedAppState {
    pub device_id: String,
    #[serde(default)]
    pub settings: AppSettings,
    #[serde(default)]
    pub session: Option<PersistedSession>,
    #[serde(default)]
    pub two_factor_tokens: HashMap<String, String>,
}

fn state_file_path() -> PathBuf {
    if let Ok(xdg) = std::env::var("XDG_CONFIG_HOME") {
        if !xdg.trim().is_empty() {
            return PathBuf::from(xdg).join("rustwarden").join("state.json");
        }
    }
    if let Ok(home) = std::env::var("HOME") {
        if !home.trim().is_empty() {
            return PathBuf::from(home)
                .join(".config")
                .join("rustwarden")
                .join("state.json");
        }
    }
    PathBuf::from("/tmp/rustwarden-state.json")
}

fn load_or_init_persisted_state() -> PersistedAppState {
    let path = state_file_path();
    if let Ok(raw) = std::fs::read_to_string(&path) {
        if let Ok(parsed) = serde_json::from_str::<PersistedAppState>(&raw) {
            if !parsed.device_id.trim().is_empty() {
                return parsed;
            }
        }
    }

    let fresh = PersistedAppState {
        device_id: Uuid::new_v4().to_string(),
        settings: AppSettings::default(),
        session: None,
        two_factor_tokens: HashMap::new(),
    };
    write_persisted_state(&fresh);
    fresh
}

fn write_persisted_state(state: &PersistedAppState) {
    let path = state_file_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(state) {
        let _ = std::fs::write(&path, json);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600));
        }
    }
}

/// Global Tauri-managed state.
pub struct AppState {
    pub http_client: Client,
    pub device_id: String,
    pub session: RwLock<Option<SessionData>>,
    pub settings: RwLock<AppSettings>,
    pub two_factor_tokens: RwLock<HashMap<String, String>>,
    /// Atomic flag mirrored from `settings.close_to_tray` for synchronous window close interception.
    pub close_to_tray_enabled: AtomicBool,
}

impl AppState {
    /// Initializes `AppState`, restoring the persistent `device_id`, settings, and locked session.
    pub fn new() -> Self {
        let persisted = load_or_init_persisted_state();

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

        let initial_session = persisted.session.map(|ps| SessionData {
            email: ps.email,
            endpoints: ps.endpoints,
            kdf_params: ps.kdf_params,
            access_token: ps.access_token,
            refresh_token: ps.refresh_token,
            protected_symmetric_key: ps.protected_symmetric_key,
            last_encrypted_sync: None,
            vault_key: None,
            decrypted_snapshot: None,
        });

        let close_to_tray = persisted.settings.close_to_tray;

        Self {
            http_client,
            device_id: persisted.device_id,
            session: RwLock::new(initial_session),
            settings: RwLock::new(persisted.settings),
            two_factor_tokens: RwLock::new(persisted.two_factor_tokens),
            close_to_tray_enabled: AtomicBool::new(close_to_tray),
        }
    }

    /// Saves the current `device_id`, `settings`, `two_factor_tokens`, and locked session metadata to disk.
    pub async fn persist(&self) {
        let session_guard = self.session.read().await;
        let settings_guard = self.settings.read().await;
        let tf_guard = self.two_factor_tokens.read().await;

        let persisted_session = session_guard.as_ref().map(|s| PersistedSession {
            email: s.email.clone(),
            endpoints: s.endpoints.clone(),
            kdf_params: s.kdf_params.clone(),
            access_token: s.access_token.clone(),
            refresh_token: s.refresh_token.clone(),
            protected_symmetric_key: s.protected_symmetric_key.clone(),
        });

        let disk_state = PersistedAppState {
            device_id: self.device_id.clone(),
            settings: settings_guard.clone(),
            session: persisted_session,
            two_factor_tokens: tf_guard.clone(),
        };
        write_persisted_state(&disk_state);
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
