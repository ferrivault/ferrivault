//! Full vault synchronization (`GET /api/sync`).

use reqwest::Client;
use serde::Deserialize;

use crate::api::endpoints::ServerEndpoints;
use crate::error::AppError;
use crate::models::{cipher::EncryptedCipher, folder::EncryptedFolder};

/// Profile block inside the `/api/sync` response.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncProfile {
    #[serde(alias = "Id")]
    pub id: Option<String>,
    #[serde(alias = "Email")]
    pub email: Option<String>,
    #[serde(alias = "Name")]
    pub name: Option<String>,
    #[serde(alias = "Key")]
    pub key: Option<String>,
}

/// Top-level payload returned by `GET /api/sync`.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResponse {
    #[serde(alias = "Profile")]
    pub profile: Option<SyncProfile>,
    #[serde(alias = "Folders", default)]
    pub folders: Vec<EncryptedFolder>,
    #[serde(alias = "Ciphers", default)]
    pub ciphers: Vec<EncryptedCipher>,
}

/// Fetches the complete encrypted vault snapshot from `GET /api/sync`.
pub async fn fetch_sync(
    client: &Client,
    endpoints: &ServerEndpoints,
    access_token: &str,
) -> Result<SyncResponse, AppError> {
    let url = format!("{}/sync?excludeDomains=true", endpoints.api_url);
    let response = client
        .get(&url)
        .header("Bitwarden-Client-Name", "desktop")
        .header("Bitwarden-Client-Version", "2024.12.0")
        .header("Device-Type", "8")
        .bearer_auth(access_token)
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(AppError::Network(format!(
            "Vault sync failed with status {status}: {text}"
        )));
    }

    let sync_data = response.json::<SyncResponse>().await?;
    Ok(sync_data)
}
