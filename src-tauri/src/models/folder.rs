//! Folder models (encrypted API wire format and decrypted UI DTO).

use serde::{Deserialize, Serialize};

use crate::crypto::{
    enc_string::{decrypt_optional, EncString},
    keys::SymmetricCryptoKey,
};
use crate::error::AppError;

/// Encrypted folder payload returned by `/api/sync` or `/api/folders`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EncryptedFolder {
    #[serde(alias = "Id")]
    pub id: Option<String>,
    #[serde(alias = "Name")]
    pub name: Option<String>,
    #[serde(alias = "RevisionDate")]
    pub revision_date: Option<String>,
}

/// Decrypted folder DTO exposed to the React frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderView {
    pub id: String,
    pub name: String,
    pub revision_date: Option<String>,
}

impl EncryptedFolder {
    /// Decrypts the folder name using the active vault's [`SymmetricCryptoKey`].
    pub fn decrypt(&self, key: &SymmetricCryptoKey) -> Result<Option<FolderView>, AppError> {
        let Some(id) = self.id.as_ref().filter(|s| !s.is_empty()) else {
            return Ok(None);
        };
        let name = decrypt_optional(self.name.as_deref(), key)?
            .unwrap_or_else(|| "Unnamed Folder".to_string());
        Ok(Some(FolderView {
            id: id.clone(),
            name,
            revision_date: self.revision_date.clone(),
        }))
    }
}

/// Request payload sent to `/api/folders` to create or rename a folder.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderRequest {
    pub name: String,
}

impl FolderRequest {
    /// Encrypts a plaintext folder name into a `FolderRequest`.
    pub fn from_plaintext(name: &str, key: &SymmetricCryptoKey) -> Result<Self, AppError> {
        Ok(Self {
            name: EncString::encrypt_utf8(name, key)?,
        })
    }
}
