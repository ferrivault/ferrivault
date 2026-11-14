//! Unified error handling for the FerriVault backend.
//!
//! All Tauri commands return `Result<T, AppError>`, where [`AppError`] serializes
//! into a structured JSON object with an `errorKey` (matching an i18n translation key
//! in `src/i18n/locales/*.json`) and a technical `message` for debugging.

use serde::Serialize;
use thiserror::Error;

/// Domain error type for cryptographic, network, and vault state operations.
#[derive(Debug, Error)]
pub enum AppError {
    /// Invalid email, master password, or two-factor authentication token.
    #[error("{0}")]
    InvalidCredentials(String),

    /// Two-step login code is required by the Bitwarden/Vaultwarden server.
    #[error("Two-factor authentication code is required")]
    TwoFactorRequired,

    /// New Device Verification OTP (sent via email by Bitwarden) is required.
    #[error("New device verification code sent to your email is required")]
    NewDeviceVerificationRequired,

    /// Network or HTTP failure while communicating with the Bitwarden/Vaultwarden server.
    #[error("Network error: {0}")]
    Network(String),

    /// Cryptographic key derivation, HMAC verification, or AES decryption failure.
    #[error("Cryptographic error: {0}")]
    Crypto(String),

    /// Operation attempted while the vault is locked and keys are wiped from memory.
    #[error("Vault is currently locked")]
    VaultLocked,

    /// Input validation error.
    #[error("Validation error: {0}")]
    Validation(String),

    /// Internal or unexpected error.
    #[error("Unexpected error: {0}")]
    Internal(String),
}

impl AppError {
    /// Returns the corresponding i18n translation key in `errors.*`.
    pub fn i18n_key(&self) -> &'static str {
        match self {
            Self::InvalidCredentials(_) => "errors.invalidCredentials",
            Self::TwoFactorRequired => "errors.twoFactorRequired",
            Self::NewDeviceVerificationRequired => "errors.newDeviceVerificationRequired",
            Self::Network(_) => "errors.networkError",
            Self::Crypto(_) => "errors.cryptoError",
            Self::VaultLocked => "errors.vaultLocked",
            Self::Validation(_) => "errors.validationRequired",
            Self::Internal(_) => "errors.unexpectedError",
        }
    }
}

/// Serialized representation sent over the Tauri IPC bridge when a command fails.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SerializedAppError<'a> {
    error_key: &'static str,
    message: &'a str,
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let msg = self.to_string();
        let payload = SerializedAppError {
            error_key: self.i18n_key(),
            message: &msg,
        };
        payload.serialize(serializer)
    }
}

impl From<reqwest::Error> for AppError {
    fn from(err: reqwest::Error) -> Self {
        Self::Network(err.to_string())
    }
}
