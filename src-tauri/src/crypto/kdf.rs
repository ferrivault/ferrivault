//! Key Derivation Functions (KDF) following the Bitwarden cryptographic specification.
//!
//! Supports both:
//! - **PBKDF2-HMAC-SHA256** (`kdf = 0`, default 600,000 iterations)
//! - **Argon2id** (`kdf = 1`, configurable iterations, memory in MiB, and parallelism)
//!
//! Also implements:
//! - **Master Password Hash** (1-iteration PBKDF2-HMAC-SHA256 over the Master Key, salted with
//!   the master password, base64-encoded for `/identity/connect/token`).
//! - **HKDF-Expand (SHA-256)** key stretching from a 32-byte `MasterKey` to a 64-byte
//!   `SymmetricCryptoKey` using `"enc"` and `"mac"` info parameters.

use argon2::{Algorithm, Argon2, Params, Version};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use hkdf::Hkdf;
use hmac::Hmac;
use pbkdf2::pbkdf2;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use zeroize::Zeroizing;

use crate::crypto::keys::{MasterKey, SymmetricCryptoKey};
use crate::error::AppError;

/// Bitwarden KDF algorithm identifier.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum KdfType {
    /// PBKDF2-HMAC-SHA256 (`0`)
    Pbkdf2Sha256 = 0,
    /// Argon2id (`1`)
    Argon2id = 1,
}

impl TryFrom<u32> for KdfType {
    type Error = AppError;

    fn try_from(value: u32) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(Self::Pbkdf2Sha256),
            1 => Ok(Self::Argon2id),
            other => Err(AppError::Crypto(format!("Unsupported KDF type: {other}"))),
        }
    }
}

/// Parameters returned by `/identity/accounts/prelogin` describing how to derive the Master Key.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KdfParams {
    /// KDF algorithm (`0` = PBKDF2-SHA256, `1` = Argon2id).
    pub kdf: u32,
    /// Iteration count (e.g. 600,000 for PBKDF2 or 3 for Argon2id).
    pub kdf_iterations: u32,
    /// Memory in MiB (only used for Argon2id, typically 64).
    pub kdf_memory: Option<u32>,
    /// Parallelism lanes (only used for Argon2id, typically 4).
    pub kdf_parallelism: Option<u32>,
}

impl Default for KdfParams {
    fn default() -> Self {
        Self {
            kdf: 0,
            kdf_iterations: 600_000,
            kdf_memory: None,
            kdf_parallelism: None,
        }
    }
}

/// Derives the 32-byte [`MasterKey`] from the user's master password, normalized email,
/// and the server's [`KdfParams`].
///
/// Per Bitwarden's specification, the email address is trimmed and lowercased before
/// being used as the salt.
pub fn derive_master_key(
    password: &str,
    email: &str,
    params: &KdfParams,
) -> Result<MasterKey, AppError> {
    let normalized_email = email.trim().to_lowercase();
    let kdf_type = KdfType::try_from(params.kdf)?;
    let mut key_bytes = Zeroizing::new([0u8; 32]);

    match kdf_type {
        KdfType::Pbkdf2Sha256 => {
            if params.kdf_iterations == 0 {
                return Err(AppError::Crypto(
                    "PBKDF2 iterations must be greater than zero".to_string(),
                ));
            }
            let _ = pbkdf2::<Hmac<Sha256>>(
                password.as_bytes(),
                normalized_email.as_bytes(),
                params.kdf_iterations,
                &mut *key_bytes,
            );
        }
        KdfType::Argon2id => {
            // Bitwarden hashes the normalized email with SHA-256 to produce a 32-byte salt
            // for Argon2id.
            let salt_hash = Sha256::digest(normalized_email.as_bytes());
            let memory_mib = params.kdf_memory.unwrap_or(64);
            let memory_kib = memory_mib.saturating_mul(1024);
            let parallelism = params.kdf_parallelism.unwrap_or(4);
            let iterations = params.kdf_iterations.max(1);

            let argon_params = Params::new(memory_kib, iterations, parallelism, Some(32))
                .map_err(|e| AppError::Crypto(format!("Invalid Argon2id parameters: {e}")))?;
            let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, argon_params);
            argon2
                .hash_password_into(password.as_bytes(), &salt_hash, &mut *key_bytes)
                .map_err(|e| AppError::Crypto(format!("Argon2id key derivation failed: {e}")))?;
        }
    }

    Ok(MasterKey::new(*key_bytes))
}

/// Derives the base64-encoded Master Password Hash transmitted to the Bitwarden server
/// during `/identity/connect/token` authentication.
///
/// Computed via 1 iteration of PBKDF2-HMAC-SHA256 with the 32-byte `MasterKey` as the password
/// and the user's plaintext master password bytes as the salt.
pub fn derive_master_password_hash(master_key: &MasterKey, password: &str) -> String {
    let mut hash_bytes = Zeroizing::new([0u8; 32]);
    let _ = pbkdf2::<Hmac<Sha256>>(
        master_key.as_bytes(),
        password.as_bytes(),
        1,
        &mut *hash_bytes,
    );
    BASE64.encode(*hash_bytes)
}

/// Stretches a 32-byte [`MasterKey`] into a 64-byte [`SymmetricCryptoKey`] using
/// `HKDF-Expand` (RFC 5869, without `HKDF-Extract`) with SHA-256.
///
/// Note: Bitwarden's key stretching uses the 32-byte `MasterKey` directly as the PRK
/// in `Hkdf::from_prk`, expanding 32 bytes with `info = b"enc"` and 32 bytes with `info = b"mac"`.
pub fn stretch_master_key(master_key: &MasterKey) -> Result<SymmetricCryptoKey, AppError> {
    let hkdf = Hkdf::<Sha256>::from_prk(master_key.as_bytes())
        .map_err(|e| AppError::Crypto(format!("HKDF PRK initialization failed: {e}")))?;

    let mut enc_key = Zeroizing::new([0u8; 32]);
    let mut mac_key = Zeroizing::new([0u8; 32]);

    hkdf.expand(b"enc", &mut *enc_key)
        .map_err(|e| AppError::Crypto(format!("HKDF expand 'enc' failed: {e}")))?;
    hkdf.expand(b"mac", &mut *mac_key)
        .map_err(|e| AppError::Crypto(format!("HKDF expand 'mac' failed: {e}")))?;

    Ok(SymmetricCryptoKey::from_parts(*enc_key, *mac_key))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derive_master_key_pbkdf2_should_produce_deterministic_output() {
        let params = KdfParams {
            kdf: 0,
            kdf_iterations: 5_000,
            kdf_memory: None,
            kdf_parallelism: None,
        };
        let key1 = derive_master_key("mySecretPassword123!", "User@Example.com ", &params).unwrap();
        let key2 = derive_master_key("mySecretPassword123!", "user@example.com", &params).unwrap();
        assert_eq!(key1.as_bytes(), key2.as_bytes());
    }

    #[test]
    fn derive_master_key_argon2id_should_succeed() {
        let params = KdfParams {
            kdf: 1,
            kdf_iterations: 2,
            kdf_memory: Some(16),
            kdf_parallelism: Some(2),
        };
        let key = derive_master_key("correct horse battery staple", "alice@example.org", &params)
            .unwrap();
        assert_ne!(key.as_bytes(), &[0u8; 32]);
    }

    #[test]
    fn stretch_master_key_should_produce_distinct_enc_and_mac_keys() {
        let master_key = MasterKey::new([42u8; 32]);
        let stretched = stretch_master_key(&master_key).unwrap();
        assert_ne!(stretched.enc_key(), stretched.mac_key());
        assert_ne!(stretched.enc_key(), &[0u8; 32]);
    }
}
