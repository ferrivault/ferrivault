//! Settings, update checking & localization synchronization Tauri commands.

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

use crate::error::AppError;
use crate::state::{AppSettings, AppState};
use crate::tray::{update_tray_menu_labels, TrayMenuLabels};

const GITHUB_LATEST_RELEASE_API: &str =
    "https://api.github.com/repos/ferrivault/ferrivault/releases/latest";

/// Result returned to the frontend when checking GitHub Releases for a newer version.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckResult {
    pub current_version: String,
    pub latest_version: String,
    pub update_available: bool,
    pub release_url: String,
    pub release_name: String,
}

#[derive(Debug, Deserialize)]
struct GithubReleaseDto {
    tag_name: String,
    html_url: String,
    name: Option<String>,
}

fn parse_semver_tuple(raw: &str) -> Option<(u64, u64, u64)> {
    let cleaned = raw.trim().trim_start_matches('v');
    let core = cleaned.split('-').next().unwrap_or(cleaned);
    let mut parts = core.split('.');
    let major = parts.next()?.parse::<u64>().ok()?;
    let minor = parts.next()?.parse::<u64>().ok()?;
    let patch = parts.next()?.parse::<u64>().ok()?;
    Some((major, minor, patch))
}

/// Checks GitHub Releases for the latest published FerriVault version.
#[tauri::command]
pub async fn check_for_updates(state: State<'_, AppState>) -> Result<UpdateCheckResult, AppError> {
    let current_version = env!("CARGO_PKG_VERSION").to_string();

    let response = state
        .http_client
        .get(GITHUB_LATEST_RELEASE_API)
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", format!("FerriVault/{current_version}"))
        .send()
        .await
        .map_err(|e| AppError::Network(format!("Update check failed: {e}")))?;

    if !response.status().is_success() {
        return Err(AppError::Network(format!(
            "Update check returned HTTP {}",
            response.status()
        )));
    }

    let release = response
        .json::<GithubReleaseDto>()
        .await
        .map_err(|e| AppError::Network(format!("Invalid release metadata JSON: {e}")))?;

    let latest_version = release.tag_name.trim().trim_start_matches('v').to_string();
    let update_available = match (
        parse_semver_tuple(&current_version),
        parse_semver_tuple(&latest_version),
    ) {
        (Some(cur), Some(lat)) => lat > cur,
        _ => false,
    };

    Ok(UpdateCheckResult {
        current_version,
        latest_version: latest_version.clone(),
        update_available,
        release_url: release.html_url,
        release_name: release
            .name
            .filter(|n| !n.trim().is_empty())
            .unwrap_or_else(|| format!("FerriVault v{latest_version}")),
    })
}

/// Retrieves the current backend settings.
#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, AppError> {
    let guard = state.settings.read().await;
    Ok(guard.clone())
}

/// Updates the backend settings (clipboard timeout, auto-lock, close-to-tray, autostart, locale).
#[tauri::command]
pub async fn update_settings(
    new_settings: AppSettings,
    state: State<'_, AppState>,
) -> Result<AppSettings, AppError> {
    crate::autostart::set_autostart(new_settings.launch_at_startup, new_settings.start_minimized)?;
    state.set_close_to_tray(new_settings.close_to_tray);
    {
        let mut guard = state.settings.write().await;
        *guard = new_settings.clone();
    }
    state.persist().await;
    Ok(new_settings)
}

/// Updates the native OS system tray menu labels whenever the frontend language changes.
#[tauri::command]
pub fn sync_tray_locale(labels: TrayMenuLabels, app: AppHandle) -> Result<(), AppError> {
    update_tray_menu_labels(&app, &labels)
}
