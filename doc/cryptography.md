# Cryptography & Security Model

FerriVault implements the official Bitwarden cryptographic specification strictly inside the Rust backend (`src-tauri/src/crypto/`) using audited crates from the **RustCrypto** project.

---

## 1. Key Derivation Workflow (`crypto/kdf.rs`)

When signing in or unlocking the vault:

1. **Email Salt Normalization**:
   - The user's email address is trimmed and converted to lowercase (`email.trim().to_lowercase()`).
2. **Master Key Derivation (`MasterKey` — 32 bytes)**:
   - **PBKDF2-HMAC-SHA256 (`kdf = 0`)**: Derives 32 bytes using the master password and the lowercase email as salt for `kdf_iterations` (typically `600,000`).
   - **Argon2id (`kdf = 1`)**: Computes `SHA-256(lowercase_email)` as the 32-byte salt and runs Argon2id (`v0x13`) with the server-provided `kdf_memory` (in MiB), `kdf_iterations`, and `kdf_parallelism`.
3. **Master Password Hash (Authentication Credential)**:
   - Computed via `1` iteration of `PBKDF2-HMAC-SHA256` using the 32-byte `MasterKey` as input and the raw master password bytes as salt, encoded in Base64.
   - Only this hash is transmitted to `/identity/connect/token`; the plaintext master password and `MasterKey` never leave the local machine.
4. **Master Key Stretching (`stretch_master_key`)**:
   - Uses `HKDF-Expand (SHA-256)` directly on the 32-byte `MasterKey` (as PRK) with:
     - `info = b"enc"` -> 32-byte AES-256 encryption key
     - `info = b"mac"` -> 32-byte HMAC-SHA256 authentication key
   - Produces the 64-byte stretched key used to decrypt the account's `ProtectedSymmetricKey`.

---

## 2. Authenticated Symmetric Encryption (`crypto/enc_string.rs`)

All vault items (ciphers, login credentials, notes, cards, identities, custom fields, and folder names) are encrypted with the user's 64-byte `SymmetricCryptoKey` using Bitwarden's `EncString` format:

```text
2.<iv_base64>|<ciphertext_base64>|<mac_base64>
```

- **Encryption (`EncString::encrypt_bytes`)**:
  1. Generates a random 16-byte IV using the OS CSPRNG (`rand::thread_rng()`).
  2. Encrypts the plaintext with **AES-256-CBC** and **PKCS#7** padding using the first 32 bytes (`enc_key`).
  3. Computes `HMAC-SHA256(iv || ciphertext)` using the last 32 bytes (`mac_key`).
- **Decryption (`EncString::decrypt_bytes`)**:
  1. Recomputes `HMAC-SHA256(iv || ciphertext)` and compares it with `mac` in **constant time** (`subtle::ConstantTimeEq`) to prevent padding oracle and timing attacks.
  2. Decrypts the ciphertext with **AES-256-CBC** and removes PKCS#7 padding into a `Zeroizing<Vec<u8>>` buffer.

---

## 3. Memory Zeroization (`crypto/keys.rs`)

- `MasterKey` and `SymmetricCryptoKey` derive `zeroize::Zeroize` and `zeroize::ZeroizeOnDrop`.
- Temporary buffers during KDF and AES decryption are wrapped in `zeroize::Zeroizing`.
- Locking the vault (`lock_vault` command or System Tray *Lock Vault* action) drops `vault_key` and clears all decrypted structs from memory.

---

## 4. Clipboard Auto-Clear (`commands/tools_cmd.rs`)

When the user copies a password, TOTP code, or card number via `copy_to_clipboard`:
1. The secret is written to the OS clipboard via `arboard`.
2. A background asynchronous timer waits for `clipboard_clear_seconds` (configurable in Settings; default: `30s`).
3. When the timer fires, FerriVault checks whether the OS clipboard still contains the exact secret copied earlier. If it matches, the clipboard is overwritten with an empty string and the UI is notified via the `clipboard:cleared` event.
