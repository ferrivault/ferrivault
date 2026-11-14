//! Server URL resolution for Bitwarden Official (US / EU) and Self-Hosted (Vaultwarden) servers.

use serde::{Deserialize, Serialize};
use url::Url;

use crate::error::AppError;

/// Supported server environment presets.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ServerRegion {
    /// Official Bitwarden US cloud (`vault.bitwarden.com`)
    OfficialUs,
    /// Official Bitwarden EU cloud (`vault.bitwarden.eu`)
    OfficialEu,
    /// Self-hosted Bitwarden or Vaultwarden instance
    SelfHosted,
}

impl Default for ServerRegion {
    fn default() -> Self {
        Self::OfficialUs
    }
}

/// Resolved base URLs for the Identity OAuth2 service and the Vault REST API.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerEndpoints {
    pub region: ServerRegion,
    pub base_url: String,
    pub api_url: String,
    pub identity_url: String,
}

impl ServerEndpoints {
    /// Resolves the `api` and `identity` endpoints for the chosen region and optional custom base URL.
    pub fn resolve(region: ServerRegion, custom_url: Option<&str>) -> Result<Self, AppError> {
        match region {
            ServerRegion::OfficialUs => Ok(Self {
                region,
                base_url: "https://vault.bitwarden.com".to_string(),
                api_url: "https://api.bitwarden.com".to_string(),
                identity_url: "https://identity.bitwarden.com".to_string(),
            }),
            ServerRegion::OfficialEu => Ok(Self {
                region,
                base_url: "https://vault.bitwarden.eu".to_string(),
                api_url: "https://api.bitwarden.eu".to_string(),
                identity_url: "https://identity.bitwarden.eu".to_string(),
            }),
            ServerRegion::SelfHosted => {
                let raw = custom_url
                    .map(str::trim)
                    .filter(|s| !s.is_empty())
                    .ok_or_else(|| {
                        AppError::Validation("Custom server URL is required for self-hosted mode".into())
                    })?;

                let parsed = Url::parse(raw).map_err(|e| {
                    AppError::Validation(format!("Invalid self-hosted server URL '{raw}': {e}"))
                })?;

                if parsed.scheme() != "https" && parsed.scheme() != "http" {
                    return Err(AppError::Validation(
                        "Server URL must use http:// or https://".into(),
                    ));
                }

                let normalized = raw.trim_end_matches('/').to_string();
                Ok(Self {
                    region,
                    base_url: normalized.clone(),
                    api_url: format!("{normalized}/api"),
                    identity_url: format!("{normalized}/identity"),
                })
            }
        }
    }
}
