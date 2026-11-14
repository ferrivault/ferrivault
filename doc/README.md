# Rustwarden Documentation

Welcome to the technical documentation for **Rustwarden**, a cross-platform desktop client for Bitwarden and Vaultwarden built with Tauri v2, Rust, React, TypeScript, and TailwindCSS.

## Documentation Index

1. **[Architecture & IPC Design](./architecture.md)**
   - Overview of the Tauri v2 two-process model (React WebView frontend + Rust native backend), state management, system tray lifecycle, and IPC command boundaries.
2. **[Cryptography & Security Model](./cryptography.md)**
   - Detailed specification of Bitwarden key derivation (`PBKDF2-HMAC-SHA256`, `Argon2id`), `HKDF-Expand` key stretching, `EncString` (`AES-256-CBC` + `HMAC-SHA256`) encryption/decryption, memory zeroization (`zeroize`), and automatic clipboard clearing.
3. **[Internationalization & Localization Guide (i18n)](./i18n.md)**
   - How the multi-language system works (`en`, `es`, `ca`), how the native OS system tray menu stays synchronized with the active language, and step-by-step instructions for adding new languages.
4. **[Development & Build Guide](./development.md)**
   - System prerequisites, `Makefile` commands reference, testing workflows, and linting standards.
