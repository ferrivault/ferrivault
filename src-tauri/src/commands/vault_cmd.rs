//! Vault synchronization and Cipher / Folder CRUD Tauri commands.

use tauri::State;

use crate::api::{
    ciphers::{
        create_cipher_remote, create_folder_remote, delete_folder_remote,
        permanent_delete_cipher_remote, restore_cipher_remote, soft_delete_cipher_remote,
        update_cipher_remote, update_folder_remote,
    },
    sync::fetch_sync,
};
use crate::commands::auth_cmd::decrypt_sync_response;
use crate::error::AppError;
use crate::models::{
    cipher::CipherView,
    folder::{FolderRequest, FolderView},
};
use crate::state::{AppState, VaultSnapshot};

/// Returns the currently decrypted vault snapshot in memory.
#[tauri::command]
pub async fn get_vault_snapshot(state: State<'_, AppState>) -> Result<VaultSnapshot, AppError> {
    let session_guard = state.session.read().await;
    let session = session_guard.as_ref().ok_or(AppError::VaultLocked)?;
    session
        .decrypted_snapshot
        .clone()
        .ok_or(AppError::VaultLocked)
}

/// Pulls the latest encrypted vault from `GET /api/sync` and decrypts it in memory.
#[tauri::command]
pub async fn sync_vault(state: State<'_, AppState>) -> Result<VaultSnapshot, AppError> {
    let (endpoints, access_token, email, vault_key) = {
        let session_guard = state.session.read().await;
        let session = session_guard.as_ref().ok_or(AppError::VaultLocked)?;
        let key = session.vault_key.clone().ok_or(AppError::VaultLocked)?;
        (
            session.endpoints.clone(),
            session.access_token.clone(),
            session.email.clone(),
            key,
        )
    };

    let sync_resp = fetch_sync(&state.http_client, &endpoints, &access_token).await?;
    let snapshot = decrypt_sync_response(&email, &endpoints.base_url, &sync_resp, &vault_key);

    let mut session_guard = state.session.write().await;
    if let Some(session) = session_guard.as_mut() {
        session.last_encrypted_sync = Some(sync_resp);
        session.decrypted_snapshot = Some(snapshot.clone());
    }

    Ok(snapshot)
}

/// Encrypts and saves (creates or updates) a cipher item on the server, returning the
/// decrypted updated `CipherView` and refreshing the in-memory vault cache.
#[tauri::command]
pub async fn save_cipher(
    cipher: CipherView,
    state: State<'_, AppState>,
) -> Result<CipherView, AppError> {
    if cipher.name.trim().is_empty() {
        return Err(AppError::Validation("Item name is required".into()));
    }

    let (endpoints, access_token, vault_key) = {
        let session_guard = state.session.read().await;
        let session = session_guard.as_ref().ok_or(AppError::VaultLocked)?;
        let key = session.vault_key.clone().ok_or(AppError::VaultLocked)?;
        (
            session.endpoints.clone(),
            session.access_token.clone(),
            key,
        )
    };

    let encrypted_payload = cipher.encrypt(&vault_key)?;
    let saved_encrypted = if cipher.id.trim().is_empty() {
        create_cipher_remote(&state.http_client, &endpoints, &access_token, &encrypted_payload)
            .await?
    } else {
        update_cipher_remote(
            &state.http_client,
            &endpoints,
            &access_token,
            &cipher.id,
            &encrypted_payload,
        )
        .await?
    };

    let saved_decrypted = saved_encrypted.decrypt(&vault_key)?;

    let mut session_guard = state.session.write().await;
    if let Some(session) = session_guard.as_mut() {
        if let Some(snapshot) = session.decrypted_snapshot.as_mut() {
            if let Some(existing) = snapshot
                .ciphers
                .iter_mut()
                .find(|c| c.id == saved_decrypted.id)
            {
                *existing = saved_decrypted.clone();
            } else {
                snapshot.ciphers.push(saved_decrypted.clone());
            }
            snapshot
                .ciphers
                .sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        }
    }

    Ok(saved_decrypted)
}

/// Soft-deletes a cipher (moves it to Trash) and updates the local snapshot.
#[tauri::command]
pub async fn delete_cipher(id: String, state: State<'_, AppState>) -> Result<VaultSnapshot, AppError> {
    let (endpoints, access_token) = {
        let session_guard = state.session.read().await;
        let session = session_guard.as_ref().ok_or(AppError::VaultLocked)?;
        if session.vault_key.is_none() {
            return Err(AppError::VaultLocked);
        }
        (session.endpoints.clone(), session.access_token.clone())
    };

    soft_delete_cipher_remote(&state.http_client, &endpoints, &access_token, &id).await?;
    sync_vault(state).await
}

/// Restores a soft-deleted cipher from Trash and updates the local snapshot.
#[tauri::command]
pub async fn restore_cipher(
    id: String,
    state: State<'_, AppState>,
) -> Result<VaultSnapshot, AppError> {
    let (endpoints, access_token) = {
        let session_guard = state.session.read().await;
        let session = session_guard.as_ref().ok_or(AppError::VaultLocked)?;
        if session.vault_key.is_none() {
            return Err(AppError::VaultLocked);
        }
        (session.endpoints.clone(), session.access_token.clone())
    };

    let _ = restore_cipher_remote(&state.http_client, &endpoints, &access_token, &id).await?;
    sync_vault(state).await
}

/// Permanently deletes a cipher from the server and removes it from the local snapshot.
#[tauri::command]
pub async fn permanent_delete_cipher(
    id: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let (endpoints, access_token) = {
        let session_guard = state.session.read().await;
        let session = session_guard.as_ref().ok_or(AppError::VaultLocked)?;
        if session.vault_key.is_none() {
            return Err(AppError::VaultLocked);
        }
        (session.endpoints.clone(), session.access_token.clone())
    };

    permanent_delete_cipher_remote(&state.http_client, &endpoints, &access_token, &id).await?;

    let mut session_guard = state.session.write().await;
    if let Some(session) = session_guard.as_mut() {
        if let Some(snapshot) = session.decrypted_snapshot.as_mut() {
            snapshot.ciphers.retain(|c| c.id != id);
        }
    }

    Ok(())
}

/// Creates or renames a folder on the server and updates the in-memory vault cache.
#[tauri::command]
pub async fn save_folder(
    id: Option<String>,
    name: String,
    state: State<'_, AppState>,
) -> Result<FolderView, AppError> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(AppError::Validation("Folder name is required".into()));
    }

    let (endpoints, access_token, vault_key) = {
        let session_guard = state.session.read().await;
        let session = session_guard.as_ref().ok_or(AppError::VaultLocked)?;
        let key = session.vault_key.clone().ok_or(AppError::VaultLocked)?;
        (
            session.endpoints.clone(),
            session.access_token.clone(),
            key,
        )
    };

    let req = FolderRequest::from_plaintext(trimmed, &vault_key)?;
    let encrypted_folder = match id.as_deref().filter(|s| !s.is_empty()) {
        Some(folder_id) => {
            update_folder_remote(&state.http_client, &endpoints, &access_token, folder_id, &req)
                .await?
        }
        None => create_folder_remote(&state.http_client, &endpoints, &access_token, &req).await?,
    };

    let folder_view = encrypted_folder
        .decrypt(&vault_key)?
        .ok_or_else(|| AppError::Internal("Server returned folder without ID".into()))?;

    let mut session_guard = state.session.write().await;
    if let Some(session) = session_guard.as_mut() {
        if let Some(snapshot) = session.decrypted_snapshot.as_mut() {
            if let Some(existing) = snapshot
                .folders
                .iter_mut()
                .find(|f| f.id == folder_view.id)
            {
                *existing = folder_view.clone();
            } else {
                snapshot.folders.push(folder_view.clone());
            }
            snapshot
                .folders
                .sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        }
    }

    Ok(folder_view)
}

/// Deletes a folder from the server and reassigns its local items to `No Folder`.
#[tauri::command]
pub async fn delete_folder(id: String, state: State<'_, AppState>) -> Result<(), AppError> {
    let (endpoints, access_token) = {
        let session_guard = state.session.read().await;
        let session = session_guard.as_ref().ok_or(AppError::VaultLocked)?;
        if session.vault_key.is_none() {
            return Err(AppError::VaultLocked);
        }
        (session.endpoints.clone(), session.access_token.clone())
    };

    delete_folder_remote(&state.http_client, &endpoints, &access_token, &id).await?;

    let mut session_guard = state.session.write().await;
    if let Some(session) = session_guard.as_mut() {
        if let Some(snapshot) = session.decrypted_snapshot.as_mut() {
            snapshot.folders.retain(|f| f.id != id);
            for cipher in &mut snapshot.ciphers {
                if cipher.folder_id.as_deref() == Some(id.as_str()) {
                    cipher.folder_id = None;
                }
            }
        }
    }

    Ok(())
}
