//! CRUD operations for Bitwarden/Vaultwarden Ciphers (`/api/ciphers`) and Folders (`/api/folders`).

use reqwest::Client;
use serde::Serialize;

use crate::api::endpoints::ServerEndpoints;
use crate::error::AppError;
use crate::models::{
    cipher::EncryptedCipher,
    folder::{EncryptedFolder, FolderRequest},
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CreateOrganizationCipherRequest<'a> {
    cipher: &'a EncryptedCipher,
    collection_ids: &'a [String],
}

/// Creates a new encrypted cipher via `POST /api/ciphers` (or `POST /api/ciphers/create` when
/// assigning the cipher to organization collections).
pub async fn create_cipher_remote(
    client: &Client,
    endpoints: &ServerEndpoints,
    access_token: &str,
    cipher: &EncryptedCipher,
) -> Result<EncryptedCipher, AppError> {
    let has_org = cipher
        .organization_id
        .as_deref()
        .is_some_and(|s| !s.is_empty());
    let col_ids = cipher.collection_ids.as_deref().unwrap_or(&[]);

    let response = if has_org && !col_ids.is_empty() {
        let url = format!("{}/ciphers/create", endpoints.api_url);
        let body = CreateOrganizationCipherRequest {
            cipher,
            collection_ids: col_ids,
        };
        client
            .post(&url)
            .bearer_auth(access_token)
            .json(&body)
            .send()
            .await?
    } else {
        let url = format!("{}/ciphers", endpoints.api_url);
        client
            .post(&url)
            .bearer_auth(access_token)
            .json(cipher)
            .send()
            .await?
    };

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(AppError::Network(format!(
            "Failed to create cipher ({status}): {text}"
        )));
    }

    Ok(response.json::<EncryptedCipher>().await?)
}

/// Updates an existing encrypted cipher via `PUT /api/ciphers/{id}`.
pub async fn update_cipher_remote(
    client: &Client,
    endpoints: &ServerEndpoints,
    access_token: &str,
    id: &str,
    cipher: &EncryptedCipher,
) -> Result<EncryptedCipher, AppError> {
    let url = format!("{}/ciphers/{id}", endpoints.api_url);
    let response = client
        .put(&url)
        .bearer_auth(access_token)
        .json(cipher)
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(AppError::Network(format!(
            "Failed to update cipher ({status}): {text}"
        )));
    }

    Ok(response.json::<EncryptedCipher>().await?)
}

/// Soft-deletes a cipher (moves to Trash) via `PUT /api/ciphers/{id}/delete`.
pub async fn soft_delete_cipher_remote(
    client: &Client,
    endpoints: &ServerEndpoints,
    access_token: &str,
    id: &str,
) -> Result<(), AppError> {
    let url = format!("{}/ciphers/{id}/delete", endpoints.api_url);
    let response = client.put(&url).bearer_auth(access_token).send().await?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(AppError::Network(format!(
            "Failed to move cipher to trash ({status}): {text}"
        )));
    }
    Ok(())
}

/// Restores a soft-deleted cipher from Trash via `PUT /api/ciphers/{id}/restore`.
pub async fn restore_cipher_remote(
    client: &Client,
    endpoints: &ServerEndpoints,
    access_token: &str,
    id: &str,
) -> Result<EncryptedCipher, AppError> {
    let url = format!("{}/ciphers/{id}/restore", endpoints.api_url);
    let response = client.put(&url).bearer_auth(access_token).send().await?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(AppError::Network(format!(
            "Failed to restore cipher ({status}): {text}"
        )));
    }

    Ok(response.json::<EncryptedCipher>().await?)
}

/// Permanently deletes a cipher via `DELETE /api/ciphers/{id}`.
pub async fn permanent_delete_cipher_remote(
    client: &Client,
    endpoints: &ServerEndpoints,
    access_token: &str,
    id: &str,
) -> Result<(), AppError> {
    let url = format!("{}/ciphers/{id}", endpoints.api_url);
    let response = client.delete(&url).bearer_auth(access_token).send().await?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(AppError::Network(format!(
            "Failed to permanently delete cipher ({status}): {text}"
        )));
    }
    Ok(())
}

/// Creates a new folder via `POST /api/folders`.
pub async fn create_folder_remote(
    client: &Client,
    endpoints: &ServerEndpoints,
    access_token: &str,
    req: &FolderRequest,
) -> Result<EncryptedFolder, AppError> {
    let url = format!("{}/folders", endpoints.api_url);
    let response = client
        .post(&url)
        .bearer_auth(access_token)
        .json(req)
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(AppError::Network(format!(
            "Failed to create folder ({status}): {text}"
        )));
    }

    Ok(response.json::<EncryptedFolder>().await?)
}

/// Renames an existing folder via `PUT /api/folders/{id}`.
pub async fn update_folder_remote(
    client: &Client,
    endpoints: &ServerEndpoints,
    access_token: &str,
    id: &str,
    req: &FolderRequest,
) -> Result<EncryptedFolder, AppError> {
    let url = format!("{}/folders/{id}", endpoints.api_url);
    let response = client
        .put(&url)
        .bearer_auth(access_token)
        .json(req)
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(AppError::Network(format!(
            "Failed to update folder ({status}): {text}"
        )));
    }

    Ok(response.json::<EncryptedFolder>().await?)
}

/// Deletes a folder via `DELETE /api/folders/{id}`.
pub async fn delete_folder_remote(
    client: &Client,
    endpoints: &ServerEndpoints,
    access_token: &str,
    id: &str,
) -> Result<(), AppError> {
    let url = format!("{}/folders/{id}", endpoints.api_url);
    let response = client.delete(&url).bearer_auth(access_token).send().await?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(AppError::Network(format!(
            "Failed to delete folder ({status}): {text}"
        )));
    }
    Ok(())
}
