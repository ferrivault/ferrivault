//! RFC 6238 / RFC 4226 Time-Based One-Time Password (TOTP) generator.
//!
//! Supports both raw Base32 secrets (e.g. `"JBSWY3DPEHPK3PXP"`) and full
//! `otpauth://totp/...` URIs with custom `algorithm` (`SHA1`, `SHA256`, `SHA512`),
//! `digits` (`6`–`10`), and `period` (default `30` seconds).

use data_encoding::BASE32_NOPAD;
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha1::Sha1;
use sha2::{Sha256, Sha512};
use std::time::{SystemTime, UNIX_EPOCH};
use url::Url;
use zeroize::Zeroizing;

use crate::error::AppError;

/// Supported HMAC digest algorithms for TOTP calculation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TotpAlgorithm {
    Sha1,
    Sha256,
    Sha512,
}

/// Parsed TOTP configuration extracted from a raw secret or `otpauth://` URI.
#[derive(Debug, Clone)]
pub struct TotpConfig {
    pub secret: Zeroizing<Vec<u8>>,
    pub algorithm: TotpAlgorithm,
    pub digits: u32,
    pub period: u64,
}

/// Live TOTP code response returned to the frontend UI.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TotpResponse {
    /// Formatted numeric code (e.g. `"123456"`).
    pub code: String,
    /// Total step period in seconds (typically `30`).
    pub period: u64,
    /// Remaining seconds before the current code expires.
    pub remaining_seconds: u64,
}

/// Decodes a Base32 secret string, ignoring whitespace, hyphens, and optional `=` padding.
fn decode_base32_secret(raw: &str) -> Result<Zeroizing<Vec<u8>>, AppError> {
    let cleaned: String = raw
        .chars()
        .filter(|c| !c.is_whitespace() && *c != '-' && *c != '=')
        .map(|c| c.to_ascii_uppercase())
        .collect();

    if cleaned.is_empty() {
        return Err(AppError::Validation("Empty TOTP secret".into()));
    }

    let decoded = BASE32_NOPAD
        .decode(cleaned.as_bytes())
        .map_err(|e| AppError::Validation(format!("Invalid Base32 TOTP secret: {e}")))?;
    Ok(Zeroizing::new(decoded))
}

/// Parses either an `otpauth://` URI, a `steam://` URI, or a raw Base32 secret string.
pub fn parse_totp_input(input: &str) -> Result<TotpConfig, AppError> {
    let trimmed = input.trim();
    if trimmed.to_ascii_lowercase().starts_with("otpauth://") {
        let parsed = Url::parse(trimmed)
            .map_err(|e| AppError::Validation(format!("Invalid otpauth URI: {e}")))?;

        let mut secret_str: Option<String> = None;
        let mut algorithm = TotpAlgorithm::Sha1;
        let mut digits: u32 = 6;
        let mut period: u64 = 30;

        for (k, v) in parsed.query_pairs() {
            match k.to_ascii_lowercase().as_str() {
                "secret" => secret_str = Some(v.into_owned()),
                "algorithm" => {
                    algorithm = match v.to_ascii_uppercase().as_str() {
                        "SHA1" => TotpAlgorithm::Sha1,
                        "SHA256" => TotpAlgorithm::Sha256,
                        "SHA512" => TotpAlgorithm::Sha512,
                        other => {
                            return Err(AppError::Validation(format!(
                                "Unsupported TOTP algorithm: {other}"
                            )))
                        }
                    };
                }
                "digits" => {
                    if let Ok(d) = v.parse::<u32>() {
                        digits = d.clamp(5, 10);
                    }
                }
                "period" => {
                    if let Ok(p) = v.parse::<u64>() {
                        if p > 0 {
                            period = p;
                        }
                    }
                }
                _ => {}
            }
        }

        let raw_secret = secret_str.ok_or_else(|| {
            AppError::Validation("Missing 'secret' parameter in otpauth URI".into())
        })?;
        let secret = decode_base32_secret(&raw_secret)?;
        Ok(TotpConfig {
            secret,
            algorithm,
            digits,
            period,
        })
    } else {
        let secret = decode_base32_secret(trimmed)?;
        Ok(TotpConfig {
            secret,
            algorithm: TotpAlgorithm::Sha1,
            digits: 6,
            period: 30,
        })
    }
}

/// Computes the HMAC digest for the 8-byte big-endian counter.
fn compute_hmac(
    algorithm: TotpAlgorithm,
    secret: &[u8],
    counter_bytes: &[u8; 8],
) -> Result<Vec<u8>, AppError> {
    match algorithm {
        TotpAlgorithm::Sha1 => {
            let mut mac = Hmac::<Sha1>::new_from_slice(secret)
                .map_err(|e| AppError::Crypto(format!("TOTP HMAC-SHA1 error: {e}")))?;
            mac.update(counter_bytes);
            Ok(mac.finalize().into_bytes().to_vec())
        }
        TotpAlgorithm::Sha256 => {
            let mut mac = Hmac::<Sha256>::new_from_slice(secret)
                .map_err(|e| AppError::Crypto(format!("TOTP HMAC-SHA256 error: {e}")))?;
            mac.update(counter_bytes);
            Ok(mac.finalize().into_bytes().to_vec())
        }
        TotpAlgorithm::Sha512 => {
            let mut mac = Hmac::<Sha512>::new_from_slice(secret)
                .map_err(|e| AppError::Crypto(format!("TOTP HMAC-SHA512 error: {e}")))?;
            mac.update(counter_bytes);
            Ok(mac.finalize().into_bytes().to_vec())
        }
    }
}

/// Generates a TOTP code for the given Unix timestamp (in seconds).
pub fn generate_totp_at(input: &str, unix_seconds: u64) -> Result<TotpResponse, AppError> {
    let config = parse_totp_input(input)?;
    let counter = unix_seconds / config.period;
    let remaining_seconds = config.period - (unix_seconds % config.period);
    let counter_bytes = counter.to_be_bytes();

    let digest = compute_hmac(config.algorithm, &config.secret, &counter_bytes)?;
    let offset = (digest.last().copied().unwrap_or(0) & 0x0f) as usize;
    if offset + 4 > digest.len() {
        return Err(AppError::Crypto("Invalid TOTP digest length".into()));
    }

    let binary = ((u32::from(digest[offset]) & 0x7f) << 24)
        | (u32::from(digest[offset + 1]) << 16)
        | (u32::from(digest[offset + 2]) << 8)
        | u32::from(digest[offset + 3]);

    let modulus = 10u32.pow(config.digits);
    let otp = binary % modulus;
    let width = config.digits as usize;
    let code = format!("{otp:0width$}");

    Ok(TotpResponse {
        code,
        period: config.period,
        remaining_seconds,
    })
}

/// Generates the current live TOTP code using the system clock.
pub fn generate_current_totp(input: &str) -> Result<TotpResponse, AppError> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| AppError::Internal(format!("System clock error: {e}")))?
        .as_secs();
    generate_totp_at(input, now)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generate_totp_at_rfc6238_test_vector_should_match() {
        // RFC 6238 SHA1 test secret "12345678901234567890" -> Base32 "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
        let secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
        let res = generate_totp_at(secret, 59).unwrap();
        assert_eq!(res.code, "287082");
        assert_eq!(res.remaining_seconds, 1);
    }

    #[test]
    fn parse_otpauth_uri_with_custom_params_should_work() {
        let uri = "otpauth://totp/GitHub:alice?secret=JBSWY3DPEHPK3PXP&issuer=GitHub&algorithm=SHA256&digits=6&period=30";
        let res = generate_totp_at(uri, 1_700_000_000).unwrap();
        assert_eq!(res.code.len(), 6);
        assert_eq!(res.period, 30);
    }
}
