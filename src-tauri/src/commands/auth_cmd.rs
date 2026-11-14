//! Authentication, vault unlock, lock, and logout Tauri commands.

use std::collections::HashMap;

use serde::Deserialize;
use tauri::State;

use crate::api::{
    auth::{fetch_prelogin, login_with_password, refresh_access_token, VerificationParams},
    endpoints::{ServerEndpoints, ServerRegion},
    sync::{fetch_sync, SyncResponse},
};
use crate::crypto::{
    enc_string::{decrypt_optional, decrypt_rsa_enc_string, EncString},
    kdf::{derive_master_key, derive_master_password_hash, stretch_master_key, KdfParams},
    keys::SymmetricCryptoKey,
};
use crate::error::AppError;
use crate::state::{
    AppState, AuthStatus, CollectionView, OrganizationView, SessionData, VaultSnapshot,
};

/// Login request payload sent from the React login view.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginPayload {
    pub email: String,
    pub master_password: String,
    pub region: ServerRegion,
    pub custom_server_url: Option<String>,
    pub two_factor_code: Option<String>,
    pub new_device_otp: Option<String>,
}

/// Decrypts the user's `ProtectedSymmetricKey` (`EncString`) using the stretched master key.
fn decrypt_vault_key(
    protected_key_wire: &str,
    stretched_master_key: &SymmetricCryptoKey,
) -> Result<SymmetricCryptoKey, AppError> {
    let enc = EncString::parse(protected_key_wire)?;
    let raw_key_bytes = enc.decrypt_bytes(stretched_master_key)?;
    SymmetricCryptoKey::from_slice(&raw_key_bytes)
}

/// Extracts and decrypts all enabled Organization symmetric keys from [`SyncResponse`].
pub(crate) fn decrypt_organization_keys(
    sync_resp: &SyncResponse,
    vault_key: &SymmetricCryptoKey,
) -> HashMap<String, SymmetricCryptoKey> {
    let mut org_keys = HashMap::new();
    let Some(profile) = &sync_resp.profile else {
        return org_keys;
    };
    let Some(enc_priv_key_str) = profile.private_key.as_deref().filter(|s| !s.is_empty()) else {
        return org_keys;
    };
    let Ok(parsed_priv) = EncString::parse(enc_priv_key_str) else {
        return org_keys;
    };
    let Ok(private_key_der) = parsed_priv.decrypt_bytes(vault_key) else {
        return org_keys;
    };

    for org in &profile.organizations {
        if !org.enabled {
            continue;
        }
        let Some(org_id) = org.id.as_deref().filter(|s| !s.is_empty()) else {
            continue;
        };
        let Some(org_key_wire) = org.key.as_deref().filter(|s| !s.is_empty()) else {
            continue;
        };
        if let Ok(raw_org_key) = decrypt_rsa_enc_string(org_key_wire, &private_key_der) {
            if let Ok(sym_key) = SymmetricCryptoKey::from_slice(&raw_org_key) {
                org_keys.insert(org_id.to_string(), sym_key);
            }
        }
    }

    org_keys
}

/// Decrypts a full [`SyncResponse`] into a [`VaultSnapshot`] using the active `vault_key`.
pub fn decrypt_sync_response(
    email: &str,
    server_url: &str,
    sync_resp: &SyncResponse,
    vault_key: &SymmetricCryptoKey,
) -> VaultSnapshot {
    let org_keys = decrypt_organization_keys(sync_resp, vault_key);

    let mut folders = Vec::new();
    for enc_folder in &sync_resp.folders {
        if let Ok(Some(folder)) = enc_folder.decrypt(vault_key) {
            folders.push(folder);
        }
    }
    folders.sort_by_key(|a| a.name.to_lowercase());

    let mut organizations = Vec::new();
    if let Some(profile) = &sync_resp.profile {
        for org in &profile.organizations {
            if !org.enabled {
                continue;
            }
            if let Some(id) = org.id.as_deref().filter(|s| !s.is_empty()) {
                let name = org
                    .name
                    .as_deref()
                    .filter(|s| !s.trim().is_empty())
                    .unwrap_or("Organization")
                    .to_string();
                organizations.push(OrganizationView {
                    id: id.to_string(),
                    name,
                });
            }
        }
    }
    organizations.sort_by_key(|a| a.name.to_lowercase());

    let mut collections = Vec::new();
    for enc_col in &sync_resp.collections {
        let Some(col_id) = enc_col.id.as_deref().filter(|s| !s.is_empty()) else {
            continue;
        };
        let Some(org_id) = enc_col.organization_id.as_deref().filter(|s| !s.is_empty()) else {
            continue;
        };
        let Some(org_key) = org_keys.get(org_id) else {
            continue;
        };
        if let Ok(Some(col_name)) = decrypt_optional(enc_col.name.as_deref(), org_key) {
            if !col_name.trim().is_empty() {
                collections.push(CollectionView {
                    id: col_id.to_string(),
                    organization_id: org_id.to_string(),
                    name: col_name,
                });
            }
        }
    }
    collections.sort_by_key(|a| a.name.to_lowercase());

    let mut ciphers = Vec::new();
    for enc_cipher in &sync_resp.ciphers {
        if let Ok(cipher) = enc_cipher.decrypt_with_org_keys(vault_key, &org_keys) {
            ciphers.push(cipher);
        }
    }
    ciphers.sort_by_key(|a| a.name.to_lowercase());

    VaultSnapshot {
        email: email.to_string(),
        server_url: server_url.to_string(),
        ciphers,
        folders,
        organizations,
        collections,
    }
}

/// Performs prelogin KDF lookup, Master Key derivation, token authentication,
/// symmetric key decryption, and initial vault synchronization.
#[tauri::command]
pub async fn login(
    payload: LoginPayload,
    state: State<'_, AppState>,
) -> Result<VaultSnapshot, AppError> {
    let email = payload.email.trim().to_lowercase();
    if email.is_empty() || payload.master_password.is_empty() {
        return Err(AppError::Validation(
            "Email and Master Password are required".into(),
        ));
    }

    let endpoints = ServerEndpoints::resolve(payload.region, payload.custom_server_url.as_deref())?;

    let kdf_params = fetch_prelogin(&state.http_client, &endpoints, &email).await?;
    let master_key = derive_master_key(&payload.master_password, &email, &kdf_params)?;
    let password_hash = derive_master_password_hash(&master_key, &payload.master_password);
    let stretched_key = stretch_master_key(&master_key)?;

    let remembered_tf = {
        let tf_guard = state.two_factor_tokens.read().await;
        tf_guard.get(&email).cloned()
    };

    let token_resp = login_with_password(
        &state.http_client,
        &endpoints,
        &email,
        &password_hash,
        &state.device_id,
        VerificationParams {
            two_factor_token: payload.two_factor_code.as_deref(),
            new_device_otp: payload.new_device_otp.as_deref(),
            remembered_two_factor_token: remembered_tf.as_deref(),
        },
    )
    .await?;

    if let Some(ref tf_tok) = token_resp.two_factor_token {
        if !tf_tok.trim().is_empty() {
            let mut tf_guard = state.two_factor_tokens.write().await;
            tf_guard.insert(email.clone(), tf_tok.clone());
        }
    }

    let sync_resp = fetch_sync(&state.http_client, &endpoints, &token_resp.access_token).await?;

    let protected_key = if !token_resp.key.is_empty() {
        token_resp.key.clone()
    } else {
        sync_resp
            .profile
            .as_ref()
            .and_then(|p| p.key.clone())
            .ok_or_else(|| {
                AppError::Crypto("Server did not return a user symmetric key".to_string())
            })?
    };

    let vault_key = decrypt_vault_key(&protected_key, &stretched_key)?;
    let snapshot = decrypt_sync_response(&email, &endpoints.base_url, &sync_resp, &vault_key);

    let effective_kdf = KdfParams {
        kdf: token_resp.kdf.unwrap_or(kdf_params.kdf),
        kdf_iterations: token_resp
            .kdf_iterations
            .unwrap_or(kdf_params.kdf_iterations),
        kdf_memory: token_resp.kdf_memory.or(kdf_params.kdf_memory),
        kdf_parallelism: token_resp.kdf_parallelism.or(kdf_params.kdf_parallelism),
    };

    {
        let mut session_guard = state.session.write().await;
        *session_guard = Some(SessionData {
            email,
            endpoints,
            kdf_params: effective_kdf,
            access_token: token_resp.access_token,
            refresh_token: token_resp.refresh_token,
            protected_symmetric_key: protected_key,
            last_encrypted_sync: Some(sync_resp),
            vault_key: Some(vault_key),
            decrypted_snapshot: Some(snapshot.clone()),
        });
    }

    state.persist().await;

    Ok(snapshot)
}

/// Unlocks a locked vault session by re-deriving the `MasterKey` and decrypting the cached
/// `ProtectedSymmetricKey` and vault snapshot.
#[tauri::command]
pub async fn unlock_vault(
    master_password: String,
    state: State<'_, AppState>,
) -> Result<VaultSnapshot, AppError> {
    if master_password.is_empty() {
        return Err(AppError::Validation("Master Password is required".into()));
    }

    let mut token_refreshed = false;
    let snapshot = {
        let mut session_guard = state.session.write().await;
        let session = session_guard.as_mut().ok_or(AppError::VaultLocked)?;

        let master_key = derive_master_key(&master_password, &session.email, &session.kdf_params)?;
        let stretched_key = stretch_master_key(&master_key)?;
        let vault_key = decrypt_vault_key(&session.protected_symmetric_key, &stretched_key)?;

        let sync_resp = match &session.last_encrypted_sync {
            Some(cached) => cached.clone(),
            None => match fetch_sync(
                &state.http_client,
                &session.endpoints,
                &session.access_token,
            )
            .await
            {
                Ok(resp) => resp,
                Err(first_err) => {
                    let Some(ref refresh_tok) = session.refresh_token.clone() else {
                        return Err(first_err);
                    };
                    let (new_access, new_refresh) =
                        refresh_access_token(&state.http_client, &session.endpoints, refresh_tok)
                            .await?;
                    session.access_token = new_access;
                    if let Some(nr) = new_refresh {
                        session.refresh_token = Some(nr);
                    }
                    token_refreshed = true;
                    fetch_sync(
                        &state.http_client,
                        &session.endpoints,
                        &session.access_token,
                    )
                    .await?
                }
            },
        };

        let snapshot = decrypt_sync_response(
            &session.email,
            &session.endpoints.base_url,
            &sync_resp,
            &vault_key,
        );

        session.last_encrypted_sync = Some(sync_resp);
        session.vault_key = Some(vault_key);
        session.decrypted_snapshot = Some(snapshot.clone());
        snapshot
    };

    if token_refreshed {
        state.persist().await;
    }

    Ok(snapshot)
}

/// Locks the vault, zeroizing the `SymmetricCryptoKey` and wiping decrypted items from RAM.
#[tauri::command]
pub async fn lock_vault(state: State<'_, AppState>) -> Result<(), AppError> {
    let mut session_guard = state.session.write().await;
    if let Some(session) = session_guard.as_mut() {
        session.lock();
    }
    Ok(())
}

/// Logs out completely, clearing all tokens, keys, and cached vault data from memory and disk.
#[tauri::command]
pub async fn logout(state: State<'_, AppState>) -> Result<(), AppError> {
    {
        let mut session_guard = state.session.write().await;
        if let Some(mut session) = session_guard.take() {
            session.lock();
        }
    }
    state.persist().await;
    Ok(())
}

/// Returns the current authentication and lock status.
#[tauri::command]
pub async fn get_auth_status(state: State<'_, AppState>) -> Result<AuthStatus, AppError> {
    let session_guard = state.session.read().await;
    match session_guard.as_ref() {
        Some(session) => Ok(AuthStatus {
            is_logged_in: true,
            is_locked: session.vault_key.is_none(),
            email: Some(session.email.clone()),
            server_url: Some(session.endpoints.base_url.clone()),
        }),
        None => Ok(AuthStatus {
            is_logged_in: false,
            is_locked: true,
            email: None,
            server_url: None,
        }),
    }
}
