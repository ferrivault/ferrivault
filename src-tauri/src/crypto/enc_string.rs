//! Bitwarden `EncString` parser, decryptor, and encryptor.
//!
//! Bitwarden encodes encrypted values as:
//! - Type `2` (`AesCbc256_HmacSha256_B64`): `2.<iv_b64>|<ciphertext_b64>|<mac_b64>`
//! - Type `0` (`AesCbc256_B64`, legacy unauthenticated): `0.<iv_b64>|<ciphertext_b64>`
//!
//! For Type `2`, the HMAC-SHA256 tag is computed over the raw bytes `iv || ciphertext`
//! using the 32-byte `mac_key` and verified in constant time prior to AES-256-CBC decryption.

use aes::cipher::{block_padding::Pkcs7, BlockDecryptMut, BlockEncryptMut, KeyIvInit};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use hmac::{Hmac, Mac};
use rand::RngCore;
use sha2::Sha256;
use subtle::ConstantTimeEq;
use zeroize::Zeroizing;

use crate::crypto::keys::SymmetricCryptoKey;
use crate::error::AppError;

type Aes256CbcEnc = cbc::Encryptor<aes::Aes256>;
type Aes256CbcDec = cbc::Decryptor<aes::Aes256>;
type HmacSha256 = Hmac<Sha256>;

/// Parsed representation of a Bitwarden `EncString`.
#[derive(Debug, Clone)]
pub struct EncString {
    /// Encryption type (`0` = AES-256-CBC no MAC, `2` = AES-256-CBC + HMAC-SHA256).
    pub enc_type: u8,
    /// 16-byte initialization vector.
    pub iv: [u8; 16],
    /// Raw AES-256-CBC ciphertext bytes.
    pub ciphertext: Vec<u8>,
    /// Optional 32-byte HMAC-SHA256 authentication tag (required for type `2`).
    pub mac: Option<[u8; 32]>,
}

impl EncString {
    /// Parses a Bitwarden `EncString` (e.g. `"2.iv_b64|ct_b64|mac_b64"`) into an [`EncString`].
    pub fn parse(raw: &str) -> Result<Self, AppError> {
        let trimmed = raw.trim();
        let (type_str, rest) = trimmed
            .split_once('.')
            .ok_or_else(|| AppError::Crypto("Malformed EncString: missing type prefix".into()))?;

        let enc_type: u8 = type_str
            .parse()
            .map_err(|_| AppError::Crypto(format!("Invalid EncString type: {type_str}")))?;

        let parts: Vec<&str> = rest.split('|').collect();

        match enc_type {
            2 => {
                if parts.len() != 3 {
                    return Err(AppError::Crypto(
                        "Type 2 EncString requires 3 pipe-separated parts (iv|ct|mac)".into(),
                    ));
                }
                let iv_vec = BASE64
                    .decode(parts[0])
                    .map_err(|e| AppError::Crypto(format!("Invalid IV base64: {e}")))?;
                let iv: [u8; 16] = iv_vec
                    .try_into()
                    .map_err(|_| AppError::Crypto("AES-CBC IV must be 16 bytes".into()))?;

                let ciphertext = BASE64
                    .decode(parts[1])
                    .map_err(|e| AppError::Crypto(format!("Invalid ciphertext base64: {e}")))?;

                let mac_vec = BASE64
                    .decode(parts[2])
                    .map_err(|e| AppError::Crypto(format!("Invalid MAC base64: {e}")))?;
                let mac: [u8; 32] = mac_vec
                    .try_into()
                    .map_err(|_| AppError::Crypto("HMAC-SHA256 tag must be 32 bytes".into()))?;

                Ok(Self {
                    enc_type,
                    iv,
                    ciphertext,
                    mac: Some(mac),
                })
            }
            0 => {
                if parts.len() < 2 {
                    return Err(AppError::Crypto(
                        "Type 0 EncString requires iv|ciphertext".into(),
                    ));
                }
                let iv_vec = BASE64
                    .decode(parts[0])
                    .map_err(|e| AppError::Crypto(format!("Invalid IV base64: {e}")))?;
                let iv: [u8; 16] = iv_vec
                    .try_into()
                    .map_err(|_| AppError::Crypto("AES-CBC IV must be 16 bytes".into()))?;

                let ciphertext = BASE64
                    .decode(parts[1])
                    .map_err(|e| AppError::Crypto(format!("Invalid ciphertext base64: {e}")))?;

                Ok(Self {
                    enc_type,
                    iv,
                    ciphertext,
                    mac: None,
                })
            }
            other => Err(AppError::Crypto(format!(
                "Unsupported EncString encryption type: {other}"
            ))),
        }
    }

    /// Formats the `EncString` into its canonical Bitwarden wire representation.
    pub fn to_wire_string(&self) -> String {
        let iv_b64 = BASE64.encode(self.iv);
        let ct_b64 = BASE64.encode(&self.ciphertext);
        match self.mac {
            Some(mac) => {
                let mac_b64 = BASE64.encode(mac);
                format!("{}.{iv_b64}|{ct_b64}|{mac_b64}", self.enc_type)
            }
            None => format!("{}.{iv_b64}|{ct_b64}", self.enc_type),
        }
    }

    /// Decrypts the `EncString` into raw bytes using the provided [`SymmetricCryptoKey`].
    ///
    /// Verifies the HMAC-SHA256 tag in constant time before performing AES-256-CBC decryption.
    pub fn decrypt_bytes(&self, key: &SymmetricCryptoKey) -> Result<Zeroizing<Vec<u8>>, AppError> {
        if self.enc_type == 2 {
            let expected_mac = self.mac.ok_or_else(|| {
                AppError::Crypto("Missing HMAC tag on Type 2 EncString".to_string())
            })?;

            let mut mac_calc = HmacSha256::new_from_slice(key.mac_key())
                .map_err(|e| AppError::Crypto(format!("HMAC key initialization failed: {e}")))?;
            mac_calc.update(&self.iv);
            mac_calc.update(&self.ciphertext);
            let computed = mac_calc.finalize().into_bytes();

            if computed.ct_eq(&expected_mac).unwrap_u8() != 1 {
                return Err(AppError::InvalidCredentials(
                    "HMAC verification failed (invalid master password or corrupted ciphertext)"
                        .into(),
                ));
            }
        }

        let mut buf = Zeroizing::new(self.ciphertext.clone());
        let decrypted_slice = Aes256CbcDec::new(key.enc_key().into(), (&self.iv).into())
            .decrypt_padded_mut::<Pkcs7>(&mut buf)
            .map_err(|_| AppError::Crypto("AES-256-CBC PKCS#7 unpadding failed".into()))?;

        let len = decrypted_slice.len();
        buf.truncate(len);
        Ok(buf)
    }

    /// Decrypts the `EncString` into a UTF-8 `String`.
    pub fn decrypt_utf8(&self, key: &SymmetricCryptoKey) -> Result<String, AppError> {
        let bytes = self.decrypt_bytes(key)?;
        String::from_utf8(bytes.to_vec())
            .map_err(|e| AppError::Crypto(format!("Decrypted payload is not valid UTF-8: {e}")))
    }

    /// Encrypts raw bytes into a Type `2` (`AesCbc256_HmacSha256_B64`) `EncString`
    /// using a fresh 16-byte CSPRNG IV.
    pub fn encrypt_bytes(plaintext: &[u8], key: &SymmetricCryptoKey) -> Result<Self, AppError> {
        let mut iv = [0u8; 16];
        rand::thread_rng().fill_bytes(&mut iv);

        let ciphertext = Aes256CbcEnc::new(key.enc_key().into(), (&iv).into())
            .encrypt_padded_vec_mut::<Pkcs7>(plaintext);

        let mut mac_calc = HmacSha256::new_from_slice(key.mac_key())
            .map_err(|e| AppError::Crypto(format!("HMAC initialization failed: {e}")))?;
        mac_calc.update(&iv);
        mac_calc.update(&ciphertext);
        let mac_bytes: [u8; 32] = mac_calc.finalize().into_bytes().into();

        Ok(Self {
            enc_type: 2,
            iv,
            ciphertext,
            mac: Some(mac_bytes),
        })
    }

    /// Encrypts a UTF-8 string and returns its canonical Type `2` Bitwarden wire string.
    pub fn encrypt_utf8(plaintext: &str, key: &SymmetricCryptoKey) -> Result<String, AppError> {
        let enc = Self::encrypt_bytes(plaintext.as_bytes(), key)?;
        Ok(enc.to_wire_string())
    }
}

/// Helper that decrypts an optional `EncString` wire string if present and non-empty.
pub fn decrypt_optional(
    raw: Option<&str>,
    key: &SymmetricCryptoKey,
) -> Result<Option<String>, AppError> {
    match raw {
        Some(s) if !s.trim().is_empty() => {
            let parsed = EncString::parse(s)?;
            Ok(Some(parsed.decrypt_utf8(key)?))
        }
        _ => Ok(None),
    }
}

/// Helper that encrypts an optional plaintext string if present and non-empty.
pub fn encrypt_optional(
    plaintext: Option<&str>,
    key: &SymmetricCryptoKey,
) -> Result<Option<String>, AppError> {
    match plaintext {
        Some(s) if !s.is_empty() => Ok(Some(EncString::encrypt_utf8(s, key)?)),
        _ => Ok(None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encrypt_and_decrypt_utf8_roundtrip_should_match() {
        let key = SymmetricCryptoKey::from_parts([11u8; 32], [22u8; 32]);
        let secret = "SuperSecretPassword!@#2026";
        let wire = EncString::encrypt_utf8(secret, &key).unwrap();
        assert!(wire.starts_with("2."));

        let parsed = EncString::parse(&wire).unwrap();
        let decrypted = parsed.decrypt_utf8(&key).unwrap();
        assert_eq!(decrypted, secret);
    }

    #[test]
    fn decrypt_with_wrong_mac_key_should_fail_hmac_verification() {
        let key1 = SymmetricCryptoKey::from_parts([11u8; 32], [22u8; 32]);
        let key2 = SymmetricCryptoKey::from_parts([11u8; 32], [99u8; 32]);
        let wire = EncString::encrypt_utf8("Sensitive data", &key1).unwrap();
        let parsed = EncString::parse(&wire).unwrap();
        assert!(parsed.decrypt_utf8(&key2).is_err());
    }
}
