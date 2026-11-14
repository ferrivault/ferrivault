# Architecture & IPC Design

Rustwarden follows a strict **separation of privileges** between the user interface and the cryptographic/network core using **Tauri v2**.

---

## 1. High-Level Component Diagram

```text
+-----------------------------------------------------------------------+
|                        React 19 + TypeScript UI                       |
|  +-----------------+   +-------------------+   +-------------------+  |
|  |  Zustand Stores |   |  i18next Engine   |   |  UI Views/Modals  |  |
|  | (Auth/Vault/Cfg)|   |  (en / es / ca)   |   | (Login/Vault/Gen) |  |
|  +--------+--------+   +---------+---------+   +---------+---------+  |
|           |                      |                       |            |
|           +----------------------+-----------------------+            |
|                                  |                                    |
|                     src/lib/tauri.ts (Typed IPC)                      |
+----------------------------------+------------------------------------+
                                   | Tauri v2 IPC Bridge
+----------------------------------+------------------------------------+
|                      Rust Backend (src-tauri/src)                     |
|                                  |                                    |
|  +-------------------------------v---------------------------------+  |
|  |                  Commands Layer (commands/*_cmd.rs)             |  |
|  +-------+-----------------------+-----------------------+---------+  |
|          |                       |                       |            |
|  +-------v--------+     +--------v--------+     +--------v---------+  |
|  |   AppState     |     |  Crypto Engine  |     |   API Client     |  |
|  | (Zeroize Keys, |     | (KDF, EncString,|     | (reqwest + rustls|  |
|  |  Vault Cache)  |     |  TOTP, CSPRNG)  |     |  US/EU/SelfHost) |  |
|  +----------------+     +-----------------+     +------------------+  |
+-----------------------------------------------------------------------+
```

---

## 2. Frontend Layer (`src/`)

- **Entry & Routing (`src/App.tsx`)**:
  - Evaluates the authentication and lock status from `useAuthStore`:
    1. Not logged in -> renders `LoginView`.
    2. Logged in & locked -> renders `LockView`.
    3. Logged in & unlocked -> renders the 3-pane vault layout (`Sidebar`, `CipherList`, and `CipherDetail` / `CipherForm`).
- **State Stores (`src/stores/`)**:
  - `authStore.ts`: Tracks session state, server region/URL preferences, and login/unlock/lock/logout transitions.
  - `vaultStore.ts`: Holds the decrypted vault items while unlocked, manages search and category/folder filtering, and coordinates CRUD operations.
  - `settingsStore.ts`: Persists user settings (language, clipboard auto-clear timeout, auto-lock timeout, close-to-tray toggle) and synchronizes them with the Rust backend.

---

## 3. Backend Layer (`src-tauri/src/`)

- **`state.rs` (`AppState` & `SessionData`)**:
  - Managed globally by Tauri and protected by `tokio::sync::RwLock`.
  - Retains the encrypted session data (`access_token`, `protected_symmetric_key`, `last_encrypted_sync`) when the vault is locked so the user can unlock using their Master Password without re-authenticating against `/identity/connect/token`.
  - Immediately drops and zeroizes `vault_key` (`SymmetricCryptoKey`) and clears `decrypted_snapshot` when `lock_vault` is triggered.
- **`api/`**:
  - `endpoints.rs`: Normalizes URLs for Bitwarden Official US (`vault.bitwarden.com`), Official EU (`vault.bitwarden.eu`), and custom self-hosted Vaultwarden servers.
  - `auth.rs`, `sync.rs`, `ciphers.rs`: Implements HTTP communication with Bitwarden/Vaultwarden REST endpoints using `reqwest` with `rustls-tls`.
- **`tray.rs`**:
  - Registers the native OS system tray icon (`rustwarden-tray`) and intercepts `WindowEvent::CloseRequested` when `close_to_tray` is active so closing the window hides it to the system tray instead of terminating the process.
