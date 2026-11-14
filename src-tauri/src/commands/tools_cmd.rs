//! Tauri commands for password/passphrase generation, live TOTP calculation,
//! URL launching, and clipboard copying with automatic timed wiping.

use std::time::Duration;
use tauri::{AppHandle, Emitter, State};

use crate::crypto::{
    generator::{
        generate_passphrase, generate_password, PassphraseGeneratorOptions,
        PasswordGeneratorOptions,
    },
    totp::{generate_current_totp, TotpResponse},
};
use crate::error::AppError;
use crate::state::AppState;

/// Generates a random password using the Rust CSPRNG engine.
#[tauri::command]
pub fn generate_password_cmd(opts: PasswordGeneratorOptions) -> Result<String, AppError> {
    generate_password(&opts)
}

/// Generates a diceware passphrase using the Rust CSPRNG engine.
#[tauri::command]
pub fn generate_passphrase_cmd(opts: PassphraseGeneratorOptions) -> Result<String, AppError> {
    generate_passphrase(&opts)
}

/// Computes the current RFC 6238 TOTP code and remaining validity seconds.
#[tauri::command]
pub fn generate_totp_cmd(secret_or_uri: String) -> Result<TotpResponse, AppError> {
    generate_current_totp(&secret_or_uri)
}

/// Copies a sensitive value to the OS clipboard and schedules an automatic wipe
/// after the user's configured timeout (`clipboard_clear_seconds`) if the clipboard
/// contents still match the copied secret.
#[tauri::command]
pub async fn copy_to_clipboard(
    text: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let clear_seconds = {
        let settings = state.settings.read().await;
        settings.clipboard_clear_seconds
    };

    let secret_clone = text.clone();
    tokio::task::spawn_blocking(move || -> Result<(), AppError> {
        let mut clipboard = arboard::Clipboard::new()
            .map_err(|e| AppError::Internal(format!("Clipboard access error: {e}")))?;
        clipboard
            .set_text(secret_clone)
            .map_err(|e| AppError::Internal(format!("Clipboard write error: {e}")))?;
        Ok(())
    })
    .await
    .map_err(|e| AppError::Internal(format!("Clipboard task join error: {e}")))??;

    if clear_seconds > 0 {
        let expected_secret = text;
        let app_handle = app.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_secs(clear_seconds)).await;
            let cleared = tokio::task::spawn_blocking(move || -> bool {
                if let Ok(mut clipboard) = arboard::Clipboard::new() {
                    if let Ok(current) = clipboard.get_text() {
                        if current == expected_secret {
                            let _ = clipboard.set_text(String::new());
                            return true;
                        }
                    }
                }
                false
            })
            .await
            .unwrap_or(false);

            if cleared {
                let _ = app_handle.emit("clipboard:cleared", ());
            }
        });
    }

    Ok(())
}

/// Opens an `http://` or `https://` URI in the user's default system browser.
#[tauri::command]
pub fn open_external_url(uri: String) -> Result<(), AppError> {
    let trimmed = uri.trim();
    let normalized = if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        trimmed.to_string()
    } else {
        format!("https://{trimmed}")
    };

    open::that(&normalized)
        .map_err(|e| AppError::Internal(format!("Failed to launch browser for '{normalized}': {e}")))
}
