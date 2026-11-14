//! Memory-safe cryptographic key containers with automatic zeroization on drop.
//!
//! Bitwarden uses 256-bit (32-byte) master keys and 512-bit (64-byte) stretched
//! symmetric keys split into a 32-byte AES-256 encryption key and a 32-byte
//! HMAC-SHA256 authentication key.

use crate::error::AppError;
use zeroize::{Zeroize, ZeroizeOnDrop};

/// 256-bit (32-byte) Master Key derived from the user's master password and email salt
/// via PBKDF2-HMAC-SHA256 or Argon2id.
#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct MasterKey(pub [u8; 32]);

impl MasterKey {
    /// Creates a new `MasterKey` from a 32-byte array.
    pub const fn new(bytes: [u8; 32]) -> Self {
        Self(bytes)
    }

    /// Returns a reference to the underlying 32-byte slice.
    pub fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }
}

/// 512-bit (64-byte) symmetric key composed of a 256-bit AES encryption key
/// and a 256-bit HMAC-SHA256 MAC key.
///
/// Used both for the stretched master key (which decrypts the user's protected
/// symmetric key) and for the vault's `SymmetricCryptoKey` (which encrypts and
/// decrypts all vault ciphers and folders).
#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct SymmetricCryptoKey {
    enc_key: [u8; 32],
    mac_key: [u8; 32],
}

impl SymmetricCryptoKey {
    /// Creates a `SymmetricCryptoKey` from separate 32-byte encryption and MAC keys.
    pub const fn from_parts(enc_key: [u8; 32], mac_key: [u8; 32]) -> Self {
        Self { enc_key, mac_key }
    }

    /// Parses a 64-byte slice into a `SymmetricCryptoKey` (first 32 bytes = AES key,
    /// last 32 bytes = HMAC key).
    pub fn from_slice(bytes: &[u8]) -> Result<Self, AppError> {
        if bytes.len() != 64 {
            return Err(AppError::Crypto(format!(
                "Expected 64-byte symmetric crypto key, got {} bytes",
                bytes.len()
            )));
        }
        let mut enc_key = [0u8; 32];
        let mut mac_key = [0u8; 32];
        enc_key.copy_from_slice(&bytes[..32]);
        mac_key.copy_from_slice(&bytes[32..64]);
        Ok(Self { enc_key, mac_key })
    }

    /// Serializes the key into a 64-byte vector (`enc_key || mac_key`).
    pub fn to_bytes(&self) -> [u8; 64] {
        let mut out = [0u8; 64];
        out[..32].copy_from_slice(&self.enc_key);
        out[32..64].copy_from_slice(&self.mac_key);
        out
    }

    /// Returns the 32-byte AES-256 encryption key.
    pub fn enc_key(&self) -> &[u8; 32] {
        &self.enc_key
    }

    /// Returns the 32-byte HMAC-SHA256 authentication key.
    pub fn mac_key(&self) -> &[u8; 32] {
        &self.mac_key
    }
}
