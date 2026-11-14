//! Bitwarden & Vaultwarden authentication client (`/prelogin` and `/connect/token`).

use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::api::endpoints::ServerEndpoints;
use crate::crypto::kdf::KdfParams;
use crate::error::AppError;

const BITWARDEN_CLIENT_NAME: &str = "desktop";
const BITWARDEN_CLIENT_VERSION: &str = "2026.10.0";

/// Request body sent to `POST /identity/accounts/prelogin`.
#[derive(Debug, Serialize)]
struct PreloginRequest<'a> {
    email: &'a str,
}

/// Error model nested inside a Bitwarden 400 response.
#[derive(Debug, Deserialize)]
struct BitwardenErrorModel {
    #[serde(alias = "Message", alias = "message")]
    message: Option<String>,
}

/// Structured error payload returned by `/identity/connect/token` on HTTP 400.
#[derive(Debug, Deserialize)]
struct TokenErrorResponse {
    error: Option<String>,
    error_description: Option<String>,
    #[serde(alias = "Message", alias = "message")]
    message: Option<String>,
    #[serde(alias = "ErrorModel", alias = "errorModel")]
    error_model: Option<BitwardenErrorModel>,
    #[serde(alias = "TwoFactorProviders", alias = "twoFactorProviders")]
    two_factor_providers: Option<Vec<u32>>,
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
    #[serde(alias = "TwoFactorToken", alias = "twoFactorToken")]
    pub two_factor_token: Option<String>,
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

    let response = client
        .post(&url)
        .header("Bitwarden-Client-Name", BITWARDEN_CLIENT_NAME)
        .header("Bitwarden-Client-Version", BITWARDEN_CLIENT_VERSION)
        .header("Device-Type", "8")
        .json(&body)
        .send()
        .await?;

    if response.status().is_success() {
        let params = response.json::<KdfParams>().await?;
        return Ok(params);
    }

    // Fallback for some reverse-proxy configurations where prelogin is mounted on /api
    let fallback_url = format!("{}/accounts/prelogin", endpoints.api_url);
    let fallback_resp = client
        .post(&fallback_url)
        .header("Bitwarden-Client-Name", BITWARDEN_CLIENT_NAME)
        .header("Bitwarden-Client-Version", BITWARDEN_CLIENT_VERSION)
        .header("Device-Type", "8")
        .json(&body)
        .send()
        .await?;
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

/// Helper to execute a single form request to `/identity/connect/token`.
async fn send_token_form(
    client: &Client,
    url: &str,
    auth_email_b64: &str,
    form: &[(&str, String)],
) -> Result<(reqwest::StatusCode, String), AppError> {
    let response = client
        .post(url)
        .header("Auth-Email", auth_email_b64)
        .header("Device-Type", "8")
        .header("Bitwarden-Client-Name", BITWARDEN_CLIENT_NAME)
        .header("Bitwarden-Client-Version", BITWARDEN_CLIENT_VERSION)
        .form(form)
        .send()
        .await?;

    let status = response.status();
    let raw_body = response.text().await.unwrap_or_default();
    Ok((status, raw_body))
}

/// Optional verification codes or remembered 2FA token passed to [`login_with_password`].
#[derive(Debug, Default, Clone, Copy)]
pub struct VerificationParams<'a> {
    pub two_factor_token: Option<&'a str>,
    pub new_device_otp: Option<&'a str>,
    pub remembered_two_factor_token: Option<&'a str>,
}

/// Authenticates against `POST /identity/connect/token` using `grant_type=password`.
///
/// Supports:
/// - Standard Master Password authentication (step 1)
/// - TOTP Authenticator 2FA (`twoFactorProvider = 0`) or Email 2FA (`twoFactorProvider = 1`)
/// - Bitwarden New Device Verification OTP (`newDeviceOtp`)
pub async fn login_with_password(
    client: &Client,
    endpoints: &ServerEndpoints,
    email: &str,
    master_password_hash: &str,
    device_id: &str,
    verification: VerificationParams<'_>,
) -> Result<TokenResponse, AppError> {
    let url = format!("{}/connect/token", endpoints.identity_url);
    let auth_email_b64 = base64::Engine::encode(
        &base64::engine::general_purpose::URL_SAFE_NO_PAD,
        email.trim().as_bytes(),
    );

    let mut base_form: Vec<(&str, String)> = vec![
        ("scope", "api offline_access".to_string()),
        ("client_id", "desktop".to_string()),
        ("grant_type", "password".to_string()),
        ("username", email.trim().to_string()),
        ("password", master_password_hash.to_string()),
        // DeviceType 8 = Linux Desktop
        ("deviceType", "8".to_string()),
        ("deviceIdentifier", device_id.to_string()),
        ("deviceName", "FerriVault Desktop".to_string()),
    ];

    if let Some(otp) = verification
        .new_device_otp
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        base_form.push(("newDeviceOtp", otp.to_string()));
        let (status, raw_body) = send_token_form(client, &url, &auth_email_b64, &base_form).await?;
        if status.is_success() {
            return serde_json::from_str::<TokenResponse>(&raw_body).map_err(|e| {
                AppError::Network(format!("Failed to parse token response JSON: {e}"))
            });
        }
        return Err(parse_token_failure(status, &raw_body));
    }

    if let Some(code) = verification
        .two_factor_token
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        let mut form_totp = base_form.clone();
        form_totp.push(("twoFactorToken", code.to_string()));
        form_totp.push(("twoFactorProvider", "0".to_string()));
        form_totp.push(("twoFactorRemember", "1".to_string()));

        let (status, raw_body) = send_token_form(client, &url, &auth_email_b64, &form_totp).await?;
        if status.is_success() {
            return serde_json::from_str::<TokenResponse>(&raw_body).map_err(|e| {
                AppError::Network(format!("Failed to parse token response JSON: {e}"))
            });
        }

        // Fallback to Email 2FA (provider 1) if the account uses email-based 2FA
        let mut form_email = base_form;
        form_email.push(("twoFactorToken", code.to_string()));
        form_email.push(("twoFactorProvider", "1".to_string()));
        form_email.push(("twoFactorRemember", "1".to_string()));
        let (status_email, body_email) =
            send_token_form(client, &url, &auth_email_b64, &form_email).await?;
        if status_email.is_success() {
            return serde_json::from_str::<TokenResponse>(&body_email).map_err(|e| {
                AppError::Network(format!("Failed to parse token response JSON: {e}"))
            });
        }

        return Err(parse_token_failure(status, &raw_body));
    }

    // If we have a remembered 2FA token (provider 5) for this device, try it first
    if let Some(rem_token) = verification
        .remembered_two_factor_token
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        let mut form_rem = base_form.clone();
        form_rem.push(("twoFactorToken", rem_token.to_string()));
        form_rem.push(("twoFactorProvider", "5".to_string()));
        form_rem.push(("twoFactorRemember", "1".to_string()));
        let (status_rem, body_rem) =
            send_token_form(client, &url, &auth_email_b64, &form_rem).await?;
        if status_rem.is_success() {
            return serde_json::from_str::<TokenResponse>(&body_rem).map_err(|e| {
                AppError::Network(format!("Failed to parse token response JSON: {e}"))
            });
        }
    }

    // Step 1: No verification code provided yet
    let (status, raw_body) = send_token_form(client, &url, &auth_email_b64, &base_form).await?;

    if status.is_success() {
        let token_resp: TokenResponse = serde_json::from_str(&raw_body)
            .map_err(|e| AppError::Network(format!("Failed to parse token response JSON: {e}")))?;
        return Ok(token_resp);
    }

    Err(parse_token_failure(status, &raw_body))
}

/// Refreshes an expired `access_token` using a persisted `refresh_token`.
pub async fn refresh_access_token(
    client: &Client,
    endpoints: &ServerEndpoints,
    refresh_token: &str,
) -> Result<(String, Option<String>), AppError> {
    #[derive(Deserialize)]
    struct RefreshResp {
        access_token: String,
        refresh_token: Option<String>,
    }

    let url = format!("{}/connect/token", endpoints.identity_url);
    let form = [
        ("grant_type", "refresh_token"),
        ("client_id", "desktop"),
        ("refresh_token", refresh_token),
    ];

    let response = client
        .post(&url)
        .header("Device-Type", "8")
        .header("Bitwarden-Client-Name", BITWARDEN_CLIENT_NAME)
        .header("Bitwarden-Client-Version", BITWARDEN_CLIENT_VERSION)
        .form(&form)
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(AppError::InvalidCredentials(format!(
            "Session token refresh failed ({status}): {text}"
        )));
    }

    let parsed = response.json::<RefreshResp>().await?;
    Ok((parsed.access_token, parsed.refresh_token))
}

/// Parses a failed `/identity/connect/token` response into a descriptive [`AppError`].
fn parse_token_failure(status: reqwest::StatusCode, raw_body: &str) -> AppError {
    let lower = raw_body.to_ascii_lowercase();

    if lower.contains("new device verification") || lower.contains("newdeviceverification") {
        return AppError::NewDeviceVerificationRequired;
    }

    if lower.contains("twofactor")
        || lower.contains("two factor")
        || lower.contains("two-step")
        || lower.contains("twofactorproviders")
    {
        return AppError::TwoFactorRequired;
    }

    if let Ok(parsed) = serde_json::from_str::<TokenErrorResponse>(raw_body) {
        if parsed.two_factor_providers.is_some() {
            return AppError::TwoFactorRequired;
        }
        if let Some(model) = parsed.error_model {
            if let Some(msg) = model.message {
                if msg.to_ascii_lowercase().contains("new device") {
                    return AppError::NewDeviceVerificationRequired;
                }
                return AppError::InvalidCredentials(msg);
            }
        }
        if let Some(msg) = parsed.message {
            if msg.to_ascii_lowercase().contains("new device") {
                return AppError::NewDeviceVerificationRequired;
            }
            return AppError::InvalidCredentials(msg);
        }
        if let Some(desc) = parsed.error_description {
            return AppError::InvalidCredentials(desc);
        }
        if let Some(err) = parsed.error {
            return AppError::InvalidCredentials(err);
        }
    }

    AppError::InvalidCredentials(format!("Authentication failed ({status}): {raw_body}"))
}
