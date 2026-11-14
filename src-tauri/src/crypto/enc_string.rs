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
use num_bigint::BigUint;
use rand::RngCore;
use sha1::Sha1;
use sha2::{Digest, Sha256};
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

/// Reads a single ASN.1 DER TLV (Tag-Length-Value) element from `input`, returning
/// `(tag, value_slice, remaining_slice)`.
fn read_der_tlv(input: &[u8]) -> Result<(u8, &[u8], &[u8]), AppError> {
    if input.len() < 2 {
        return Err(AppError::Crypto("Unexpected EOF in ASN.1 DER".into()));
    }
    let tag = input[0];
    let len_byte = input[1];
    let (len, header_len) = if (len_byte & 0x80) == 0 {
        (len_byte as usize, 2usize)
    } else {
        let num_octets = (len_byte & 0x7f) as usize;
        if num_octets == 0 || num_octets > 4 || input.len() < 2 + num_octets {
            return Err(AppError::Crypto("Invalid ASN.1 DER length encoding".into()));
        }
        let mut l = 0usize;
        for &b in &input[2..2 + num_octets] {
            l = (l << 8) | (b as usize);
        }
        (l, 2 + num_octets)
    };

    if input.len() < header_len + len {
        return Err(AppError::Crypto("ASN.1 DER value exceeds buffer".into()));
    }
    Ok((
        tag,
        &input[header_len..header_len + len],
        &input[header_len + len..],
    ))
}

/// Extracts the RSA modulus `n` and private exponent `d` from a PKCS#8 or PKCS#1 DER private key.
fn parse_rsa_private_key_der(der: &[u8]) -> Result<(BigUint, BigUint), AppError> {
    let (tag, seq_body, _) = read_der_tlv(der)?;
    if tag != 0x30 {
        return Err(AppError::Crypto(
            "Expected ASN.1 SEQUENCE in RSA key".into(),
        ));
    }

    // Read version INTEGER
    let (v_tag, _, rest) = read_der_tlv(seq_body)?;
    if v_tag != 0x02 {
        return Err(AppError::Crypto(
            "Expected version INTEGER in RSA key".into(),
        ));
    }

    // Check next element: in PKCS#8 it is AlgorithmIdentifier SEQUENCE (0x30);
    // in raw PKCS#1 RSAPrivateKey it is modulus INTEGER (0x02).
    let (next_tag, next_val, rest_after_next) = read_der_tlv(rest)?;
    let pkcs1_seq = if next_tag == 0x30 {
        // PKCS#8 PrivateKeyInfo: next element is OCTET STRING (0x04) containing PKCS#1 RSAPrivateKey
        let (oct_tag, oct_val, _) = read_der_tlv(rest_after_next)?;
        if oct_tag != 0x04 {
            return Err(AppError::Crypto(
                "Expected OCTET STRING in PKCS#8 PrivateKeyInfo".into(),
            ));
        }
        let (inner_tag, inner_body, _) = read_der_tlv(oct_val)?;
        if inner_tag != 0x30 {
            return Err(AppError::Crypto(
                "Expected inner RSAPrivateKey SEQUENCE".into(),
            ));
        }
        let (iv_tag, _, inner_rest) = read_der_tlv(inner_body)?;
        if iv_tag != 0x02 {
            return Err(AppError::Crypto(
                "Expected version INTEGER in RSAPrivateKey".into(),
            ));
        }
        inner_rest
    } else if next_tag == 0x02 {
        // Already PKCS#1: `rest` starts at modulus INTEGER
        let _ = next_val;
        rest
    } else {
        return Err(AppError::Crypto("Unexpected ASN.1 tag in RSA key".into()));
    };

    let (n_tag, n_bytes, rest1) = read_der_tlv(pkcs1_seq)?;
    let (e_tag, _e_bytes, rest2) = read_der_tlv(rest1)?;
    let (d_tag, d_bytes, _) = read_der_tlv(rest2)?;
    if n_tag != 0x02 || e_tag != 0x02 || d_tag != 0x02 {
        return Err(AppError::Crypto(
            "Expected INTEGER components (n, e, d) in RSAPrivateKey".into(),
        ));
    }

    Ok((
        BigUint::from_bytes_be(n_bytes),
        BigUint::from_bytes_be(d_bytes),
    ))
}

/// RFC 8017 MGF1 mask generation function using either SHA-1 or SHA-256.
fn mgf1(seed: &[u8], mask_len: usize, use_sha256: bool) -> Vec<u8> {
    let mut out = Vec::with_capacity(mask_len + 32);
    let mut counter: u32 = 0;
    while out.len() < mask_len {
        let counter_bytes = counter.to_be_bytes();
        if use_sha256 {
            let mut hasher = Sha256::new();
            hasher.update(seed);
            hasher.update(counter_bytes);
            out.extend_from_slice(&hasher.finalize());
        } else {
            let mut hasher = Sha1::new();
            hasher.update(seed);
            hasher.update(counter_bytes);
            out.extend_from_slice(&hasher.finalize());
        }
        counter += 1;
    }
    out.truncate(mask_len);
    out
}

/// Decrypts a Bitwarden asymmetric RSA-OAEP `EncString` (types `3`, `4`, `5`, `6`)
/// using the user's decrypted PKCS#8 DER RSA private key.
pub fn decrypt_rsa_enc_string(
    raw: &str,
    private_key_der: &[u8],
) -> Result<Zeroizing<Vec<u8>>, AppError> {
    let trimmed = raw.trim();
    let (type_str, rest) = trimmed
        .split_once('.')
        .ok_or_else(|| AppError::Crypto("Malformed RSA EncString".into()))?;
    let enc_type: u8 = type_str
        .parse()
        .map_err(|_| AppError::Crypto(format!("Invalid RSA EncString type: {type_str}")))?;

    let use_sha256 = match enc_type {
        3 | 5 => true,
        4 | 6 => false,
        other => {
            return Err(AppError::Crypto(format!(
                "Unsupported RSA EncString type: {other}"
            )))
        }
    };

    let ct_b64 = rest.split('|').next().unwrap_or("");
    let ciphertext = BASE64
        .decode(ct_b64)
        .map_err(|e| AppError::Crypto(format!("Invalid RSA ciphertext base64: {e}")))?;

    let (n, d) = parse_rsa_private_key_der(private_key_der)?;
    let k = (n.bits() as usize).div_ceil(8);
    if ciphertext.len() != k {
        return Err(AppError::Crypto(format!(
            "RSA ciphertext length ({}) does not match modulus byte length ({k})",
            ciphertext.len()
        )));
    }

    let c = BigUint::from_bytes_be(&ciphertext);
    let m = c.modpow(&d, &n);
    let m_bytes = m.to_bytes_be();
    let mut em = Zeroizing::new(vec![0u8; k]);
    let offset = k.saturating_sub(m_bytes.len());
    em[offset..].copy_from_slice(&m_bytes);

    let (h_len, l_hash): (usize, Vec<u8>) = if use_sha256 {
        (32, Sha256::digest(b"").to_vec())
    } else {
        (20, Sha1::digest(b"").to_vec())
    };

    if k < 2 * h_len + 2 || em[0] != 0x00 {
        return Err(AppError::Crypto(
            "RSA-OAEP outer padding check failed".into(),
        ));
    }

    let masked_seed = &em[1..1 + h_len];
    let masked_db = &em[1 + h_len..k];

    let seed_mask = mgf1(masked_db, h_len, use_sha256);
    let mut seed = Zeroizing::new(vec![0u8; h_len]);
    for i in 0..h_len {
        seed[i] = masked_seed[i] ^ seed_mask[i];
    }

    let db_len = k - h_len - 1;
    let db_mask = mgf1(&seed, db_len, use_sha256);
    let mut db = Zeroizing::new(vec![0u8; db_len]);
    for i in 0..db_len {
        db[i] = masked_db[i] ^ db_mask[i];
    }

    if db[..h_len].ct_eq(&l_hash).unwrap_u8() != 1 {
        return Err(AppError::Crypto("RSA-OAEP label hash mismatch".into()));
    }

    let mut idx = h_len;
    while idx < db_len && db[idx] == 0x00 {
        idx += 1;
    }
    if idx >= db_len || db[idx] != 0x01 {
        return Err(AppError::Crypto(
            "RSA-OAEP 0x01 separator byte not found".into(),
        ));
    }

    Ok(Zeroizing::new(db[idx + 1..].to_vec()))
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
