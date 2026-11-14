# Rustwarden

**Rustwarden** is a fast, memory-safe, cross-platform desktop client for **Bitwarden** (`bitwarden.com`, `bitwarden.eu`) and self-hosted **Vaultwarden** servers, built with **Tauri v2**, **Rust**, **React**, **TypeScript**, and **TailwindCSS**.

---

## Key Features

- **Rust Cryptographic Engine (`RustCrypto`)**:
  - Master Key derivation via **PBKDF2-HMAC-SHA256** (`kdf = 0`) and **Argon2id** (`kdf = 1`).
  - Key stretching via **HKDF-Expand (SHA-256)** (`"enc"` + `"mac"`).
  - Full Bitwarden `EncString` (`Type 2`: **AES-256-CBC** + constant-time **HMAC-SHA256** verification).
  - Automatic memory wiping (`zeroize::ZeroizeOnDrop`) when locking the vault.
- **Official & Self-Hosted Compatibility**:
  - Connect to Bitwarden Official US, Bitwarden Official EU, or any self-hosted **Vaultwarden** / Bitwarden instance.
- **Complete Vault Capabilities**:
  - **Cipher Types**: Login (Username, Password, multiple URIs, TOTP), Secure Note, Card, and Identity, plus Custom Fields (Text & Hidden).
  - **Organization**: Folders, Favorites, Trash (soft delete, restore, permanent delete), and real-time search.
- **Built-in Security Tools**:
  - Live **TOTP (RFC 6238)** 2FA code generator with visual countdown timer.
  - **CSPRNG Password & Diceware Passphrase Generator** with configurable character sets and word lists.
  - **Clipboard Auto-Clear**: Automatically wipes copied passwords, TOTP codes, and card numbers from the OS clipboard after a configurable timeout (default: 30 seconds).
- **Native System Tray Integration**:
  - Persistent system tray icon with localized context menu (*Show/Hide*, *Password Generator*, *Sync Vault*, *Lock Vault*, *Quit*) and configurable close-to-tray behavior.
- **Multi-Language & Extensible Localization (i18n)**:
  - Ships with complete translations for **English (`en`)**, **Spanish (`es`)**, and **Catalan (`ca`)**.
  - Architected so contributors can add a new language in minutes.

---

## Adding a New Translation (Community Guide)

All user-facing text is managed through `i18next` JSON dictionaries located in `src/i18n/locales/`.

1. Copy `src/i18n/locales/en.json` to `src/i18n/locales/<locale_code>.json` (for example, `fr.json` or `de.json`).
2. Translate all values in the new JSON file while preserving the keys and `{{interpolation}}` placeholders.
3. Register the new locale in `src/i18n/config.ts` by importing the JSON file and adding an entry to `SUPPORTED_LOCALES`:
   ```ts
   {
     code: "fr",
     name: "French",
     nativeName: "Français",
     translation: fr,
   }
   ```
4. Verify 100% key parity against `en.json`:
   ```bash
   npm run test:i18n
   ```

---

## Development & Building

### Prerequisites
- **Rust** (`1.77+`) and Cargo
- **Node.js** (`20+`) and npm
- Platform system dependencies for **Tauri v2** (on Linux: `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`)

### Commands (via `Makefile`)

```bash
# Show all available Make targets
make help

# Install frontend dependencies and prefetch Rust crates
make setup

# Run all checks (formatting, Clippy, TypeScript, i18n parity, and unit tests)
make check

# Launch Tauri desktop application in development mode
make dev

# Build production desktop bundle
make build
```

---

## Documentation (`doc/`)

Detailed technical documentation is located in the [`doc/`](./doc/README.md) directory:
- [Architecture & IPC Design](./doc/architecture.md)
- [Cryptography & Security Model](./doc/cryptography.md)
- [Internationalization & Localization Guide (i18n)](./doc/i18n.md)
- [Development & Build Guide](./doc/development.md)
