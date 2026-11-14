# AGENTS.md — Rustwarden Architecture & Engineering Guidelines

## 1. Project Overview

**Rustwarden** is a fast, secure, cross-platform desktop client for Bitwarden and Vaultwarden (self-hosted), built with **Tauri v2**, **Rust**, **React**, **TypeScript**, and **TailwindCSS**.

### Core Objectives
- **Security First**: All cryptographic operations, master key derivation, vault decryption/encryption, TOTP generation, and clipboard clearing occur strictly in the **Rust backend**. Plaintext secrets only cross the IPC boundary when explicitly requested by the UI, and sensitive memory in Rust is zeroized on drop (`zeroize`).
- **Server Compatibility**: Full support for official Bitwarden servers (`bitwarden.com`, `bitwarden.eu`) and self-hosted instances (Vaultwarden / custom URLs).
- **Complete Basic Vault Capabilities**:
  - Cipher types: **Login** (username, password, URIs, TOTP), **Secure Note**, **Card**, and **Identity**.
  - Organization: **Folders**, **Favorites**, **Trash** (soft delete / restore / permanent delete), and instant search/filtering.
  - Tools: **Password & Passphrase Generator**, built-in **TOTP (2FA)** live code generator with countdown, and **Clipboard Auto-Clear**.
- **System Tray Integration**: Native OS system tray icon with context menu (Show/Hide window, Lock Vault, Quick Generator, Quit) and configurable close-to-tray behavior.
- **Extensible Internationalization (i18n)**: Built-in support for **English (`en`)**, **Spanish (`es`)**, and **Catalan (`ca`)**, architected so community contributors can add new languages by simply adding a single JSON locale file and registering its metadata.

---

## 2. Language & Localization Policy

> **CRITICAL RULE**:
> - **All code, identifiers, types, git commit messages, documentation, and inline comments (`//`, `///`, `/** */`) MUST be written in English.**
> - **Never hardcode user-facing strings in UI components or Rust error messages shown directly to users.** All user-facing text must go through the i18n translation system using structured translation keys.

### Supported Locales (Initial Release)
- `en`: English (Fallback & reference locale)
- `es`: Español (Castilian Spanish)
- `ca`: Català (Catalan)

### Adding a New Language
1. Copy `src/i18n/locales/en.json` to `src/i18n/locales/<locale_code>.json`.
2. Translate all keys in the new JSON file.
3. Register the locale metadata (`code`, `name`, `nativeName`) in `src/i18n/config.ts`.
4. The language selector in Settings and tray menu synchronization will automatically pick up the new language.

---

## 3. Technology Stack

### Frontend (`src/`)
- **Framework**: React 19 + TypeScript (Vite bundler)
- **Styling**: TailwindCSS + ShadCN-UI patterns (`lucide-react` icons, `clsx`, `tailwind-merge`)
- **State Management**: Zustand (`useAuthStore`, `useVaultStore`, `useSettingsStore`)
- **Internationalization**: `i18next` + `react-i18next`
- **Tauri Bindings**: `@tauri-apps/api` v2, `@tauri-apps/plugin-clipboard-manager`, `@tauri-apps/plugin-shell`

### Backend (`src-tauri/`)
- **Framework**: Tauri v2 (`tauri` with `tray-icon` feature)
- **HTTP Client**: `reqwest` (`rustls-tls`, `json`)
- **Cryptography**:
  - KDF: `pbkdf2`, `argon2`, `sha2`, `hmac`
  - Symmetric Encryption: `aes`, `cbc` (`EncString` Type `2`: AES-256-CBC + HMAC-SHA256)
  - Asymmetric Encryption: `rsa` (for account/organization keypairs)
  - CSPRNG & Memory Safety: `rand`, `zeroize`
  - Encoding: `base64`, `url`
- **TOTP**: Custom RFC 6238 / RFC 4226 implementation using `hmac` + `sha1`/`sha2` (supporting `otpauth://` URIs and raw Base32 secrets)
- **Error Handling**: `thiserror` for structured domain errors serialized cleanly to the frontend

---

## 4. Directory Structure

```text
rustwarden/
├── AGENTS.md                        # AI Agent & developer guidelines (this file)
├── README.md                        # Project documentation (in English)
├── package.json                     # Frontend dependencies and scripts
├── tsconfig.json                    # Strict TypeScript configuration
├── vite.config.ts                   # Vite configuration for Tauri v2
├── index.html                       # Application entry HTML
├── src/                             # React + TypeScript Frontend
│   ├── main.tsx                     # React bootstrap & i18n initialization
│   ├── App.tsx                      # Root layout & auth routing guard
│   ├── i18n/                        # Internationalization module
│   │   ├── config.ts                # Supported locales registry & i18next setup
│   │   └── locales/                 # Translation dictionaries
│   │       ├── en.json              # English (source of truth)
│   │       ├── es.json              # Spanish (Castellano)
│   │       └── ca.json              # Catalan (Català)
│   ├── types/                       # Shared TypeScript interfaces matching Rust DTOs
│   │   ├── auth.ts
│   │   ├── vault.ts
│   │   └── settings.ts
│   ├── lib/                         # Tauri IPC wrappers & utility helpers
│   │   ├── tauri.ts                 # Typed invoke() wrappers for all Rust commands
│   │   └── utils.ts                 # Tailwind class merging & formatting helpers
│   ├── stores/                      # Zustand state stores
│   │   ├── authStore.ts             # Session state, server URLs, lock/logout actions
│   │   ├── vaultStore.ts            # Decrypted ciphers, folders, filters, CRUD actions
│   │   └── settingsStore.ts         # Language, theme, clipboard timeout, tray behavior
│   └── components/                  # UI Components
│       ├── ui/                      # Reusable atomic UI primitives (Button, Input, Modal, etc.)
│       ├── auth/                    # Login, Server Configuration, and Lock Screen views
│       ├── layout/                  # Sidebar (Folders/Types), Header (Search/Sync), StatusBar
│       ├── vault/                   # CipherList, CipherDetail, CipherForm (Login/Note/Card/Identity)
│       ├── tools/                   # Password/Passphrase Generator modal & TOTP badge
│       └── settings/                # Preferences modal (Language, Security, Server, About)
└── src-tauri/                       # Rust Backend (Tauri v2)
    ├── Cargo.toml                   # Rust crate dependencies & lint configuration
    ├── tauri.conf.json              # Tauri v2 configuration, CSP, window & tray settings
    ├── capabilities/                # Tauri v2 security capabilities & permissions
    └── src/
        ├── main.rs                  # Binary entry point
        ├── lib.rs                   # Tauri Builder, managed state, tray & command registration
        ├── error.rs                 # Unified AppError enum using thiserror
        ├── state.rs                 # Thread-safe AppState (active session, keys, cached vault)
        ├── crypto/                  # Bitwarden cryptographic specification implementation
        │   ├── mod.rs
        │   ├── kdf.rs               # PBKDF2-SHA256 & Argon2id master key derivation + HKDF stretching
        │   ├── enc_string.rs        # Bitwarden EncString parser & AES-256-CBC-HMAC-SHA256 cipher
        │   ├── keys.rs              # SymmetricCryptoKey & Zeroize wrappers
        │   ├── totp.rs              # RFC 6238 TOTP generator & otpauth:// parser
        │   └── generator.rs         # CSPRNG password & EFF diceware passphrase generator
        ├── api/                     # Bitwarden / Vaultwarden REST API client
        │   ├── mod.rs
        │   ├── endpoints.rs         # Server URL resolution (Official US/EU & Self-Hosted)
        │   ├── auth.rs              # /identity/accounts/prelogin & /identity/connect/token
        │   ├── sync.rs              # /api/sync full vault synchronization
        │   └── ciphers.rs           # /api/ciphers & /api/folders CRUD endpoints
        ├── models/                  # Domain & API data structures
        │   ├── mod.rs
        │   ├── cipher.rs            # Encrypted & decrypted Cipher models (Login, Note, Card, Identity)
        │   └── folder.rs            # Encrypted & decrypted Folder models
        ├── commands/                # #[tauri::command] IPC handlers
        │   ├── mod.rs
        │   ├── auth_cmd.rs
        │   ├── vault_cmd.rs
        │   ├── tools_cmd.rs
        │   └── settings_cmd.rs
        └── tray.rs                  # System tray icon, localized menu builder & window event handler
```

---

## 5. Engineering & Coding Standards

### Rust Best Practices (`src-tauri/`)
1. **No Panics in Production**: Never use `.unwrap()` or `.expect()` in command handlers, crypto modules, or API clients. Always return `Result<T, AppError>`.
2. **Memory Hygiene**: Any struct holding raw cryptographic keys (`MasterKey`, `StretchedMasterKey`, `SymmetricCryptoKey`) must derive or implement `zeroize::Zeroize` and `zeroize::ZeroizeOnDrop`.Locking the vault must explicitly clear the in-memory keys and decrypted vault cache.
3. **Borrowing over Cloning**: Prefer `&str` and `&[u8]` in function signatures over owned `String` or `Vec<u8>`.
4. **Clippy & Formatting**: Keep code clean under `cargo clippy --all-targets -- -D warnings`.
5. **Documentation**: Document all public modules, structs, and functions with `///` doc comments in English. Explain *why* in `//` comments for cryptographic steps or Bitwarden protocol quirks.

### TypeScript & React Best Practices (`src/`)
1. **Strict Typing**: Never use `any`. All Tauri IPC calls must go through typed helper functions in `src/lib/tauri.ts`.
2. **Zero Hardcoded Text**: Every label, placeholder, tooltip, notification, and error fallback must use `const { t } = useTranslation()`.
3. **Security in UI**:
   - Password, CVV, and secret fields must be masked (`type="password"`) by default with an explicit toggle to reveal.
   - Copying sensitive fields must invoke the backend `copy_to_clipboard` command, which schedules an automatic clipboard wipe after the configured timeout (e.g., 30 seconds) if the clipboard contents still match.

---

## 6. Verification Checklist Before Committing
- [ ] `cargo check` and `cargo test` pass in `src-tauri/` with zero warnings.
- [ ] `npm run build` (TypeScript typecheck + Vite bundle) passes with zero errors.
- [ ] `en.json`, `es.json`, and `ca.json` have identical key structures (no missing translations).
- [ ] All comments, docstrings, and documentation are in English.
