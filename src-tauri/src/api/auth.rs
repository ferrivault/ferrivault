//! Bitwarden & Vaultwarden authentication client (`/prelogin` and `/connect/token`).

use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::api::endpoints::ServerEndpoints;
use crate::crypto::kdf::KdfParams;
use crate::error::AppError;

/// Request body sent to `POST /identity/accounts/prelogin`.
#[derive(Debug, Serialize)]
struct PreloginRequest<'a> {
    email: &'a str,
}

/// Response returned by `POST /identity/connect/token`.
#[derive(Debug, Clone, Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub expires_in: Option<u64>,
    pub token_type: Option<String>,
    pub refresh_token: Option<String>,
    /// Protected Symmetric Crypto Key (`EncString` encrypted with the stretched Master Key).
    #[serde(alias = "Key", alias = "key")]
    pub key: String,
    #[serde(alias = "PrivateKey", alias = "privateKey")]
    pub private_key: Option<String>,
    #[serde(alias = "Kdf", alias = "kdf")]
    pub kdf: Option<u32>,
    #[serde(alias = "KdfIterations", alias = "kdfIterations")]
    pub kdf_iterations: Option<u32>,
    #[serde(alias = "KdfMemory", alias = "kdfMemory")]
    pub kdf_memory: Option<u32>,
    #[serde(alias = "KdfParallelism", alias = "kdfParallelism")]
    pub kdf_parallelism: Option<u32>,
}

/// Queries `/identity/accounts/prelogin` (falling back to `/api/accounts/prelogin`)
/// to retrieve the user's KDF parameters before deriving the Master Key.
pub async fn fetch_prelogin(
    client: &Client,
    endpoints: &ServerEndpoints,
    email: &str,
) -> Result<KdfParams, AppError> {
    let url = format!("{}/accounts/prelogin", endpoints.identity_url);
    let body = PreloginRequest {
        email: email.trim(),
    };

    let response = client.post(&url).json(&body).send().await?;

    if response.status().is_success() {
        let params = response.json::<KdfParams>().await?;
        return Ok(params);
    }

    // Fallback for some reverse-proxy configurations where prelogin is mounted on /api
    let fallback_url = format!("{}/accounts/prelogin", endpoints.api_url);
    let fallback_resp = client.post(&fallback_url).json(&body).send().await?;
    if fallback_resp.status().is_success() {
        let params = fallback_resp.json::<KdfParams>().await?;
        return Ok(params);
    }

    let status = response.status();
    let text = response.text().await.unwrap_or_default();
    Err(AppError::Network(format!(
        "Prelogin failed with status {status}: {text}"
    )))
}

/// Authenticates against `POST /identity/connect/token` using `grant_type=password`.
pub async fn login_with_password(
    client: &Client,
    endpoints: &ServerEndpoints,
    email: &str,
    master_password_hash: &str,
    device_id: &str,
    two_factor_token: Option<&str>,
) -> Result<TokenResponse, AppError> {
    let url = format!("{}/connect/token", endpoints.identity_url);
    let auth_email_b64 = base64::Engine::encode(
        &base64::engine::general_purpose::URL_SAFE_NO_PAD,
        email.trim().as_bytes(),
    );

    let mut form: Vec<(&str, String)> = vec![
        ("scope", "api offline_access".to_string()),
        ("client_id", "desktop".to_string()),
        ("grant_type", "password".to_string()),
        ("username", email.trim().to_string()),
        ("password", master_password_hash.to_string()),
        // DeviceType 8 = Linux Desktop (standard Bitwarden desktop identifier)
        ("deviceType", "8".to_string()),
        ("deviceIdentifier", device_id.to_string()),
        ("deviceName", "Rustwarden Desktop".to_string()),
    ];

    if let Some(code) = two_factor_token.map(str::trim).filter(|s| !s.is_empty()) {
        form.push(("twoFactorToken", code.to_string()));
        // Provider 0 = Authenticator (TOTP)
        form.push(("twoFactorProvider", "0".to_string()));
        form.push(("twoFactorRemember", "0".to_string()));
    }

    let response = client
        .post(&url)
        .header("Auth-Email", auth_email_b64)
        .header("Device-Type", "8")
        .form(&form)
        .send()
        .await?;

    let status = response.status();
    let raw_body = response.text().await.unwrap_or_default();

    if status.is_success() {
        let token_resp: TokenResponse = serde_json::from_str(&raw_body).map_err(|e| {
            AppError::Network(format!("Failed to parse token response JSON: {e}"))
        })?;
        return Ok(token_resp);
    }

    let lower = raw_body.to_ascii_lowercase();
    if lower.contains("twofactor") || lower.contains("two-step") || lower.contains("twofactorproviders") {
        return Err(AppError::TwoFactorRequired);
    }

    Err(AppError::InvalidCredentials(format!(
        "Authentication rejected ({status}): {raw_body}"
    )))
}
