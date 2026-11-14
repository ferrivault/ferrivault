//! Settings & localization synchronization Tauri commands.

use tauri::{AppHandle, State};

use crate::error::AppError;
use crate::state::{AppSettings, AppState};
use crate::tray::{update_tray_menu_labels, TrayMenuLabels};

/// Retrieves the current backend settings.
#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, AppError> {
    let guard = state.settings.read().await;
    Ok(guard.clone())
}

/// Updates the backend settings (clipboard timeout, auto-lock, close-to-tray, locale).
#[tauri::command]
pub async fn update_settings(
    new_settings: AppSettings,
    state: State<'_, AppState>,
) -> Result<AppSettings, AppError> {
    state.set_close_to_tray(new_settings.close_to_tray);
    let mut guard = state.settings.write().await;
    *guard = new_settings.clone();
    Ok(new_settings)
}

/// Updates the native OS system tray menu labels whenever the frontend language changes.
#[tauri::command]
pub fn sync_tray_locale(labels: TrayMenuLabels, app: AppHandle) -> Result<(), AppError> {
    update_tray_menu_labels(&app, &labels)
}
