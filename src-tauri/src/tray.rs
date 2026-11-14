//! System tray integration and localized context menu management.
//!
//! Creates a persistent OS tray icon (`"ferrivault-tray"`) with a localized menu
//! that can be dynamically updated whenever the user switches the UI language.

use serde::{Deserialize, Serialize};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Runtime,
};

use crate::error::AppError;
use crate::state::AppState;

/// Tray icon identifier registered with Tauri.
pub const TRAY_ID: &str = "ferrivault-tray";

/// Localized labels sent from the frontend i18n module to update the native OS tray menu.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayMenuLabels {
    pub show_window: String,
    pub open_generator: String,
    pub sync_vault: String,
    pub lock_vault: String,
    pub quit: String,
}

impl Default for TrayMenuLabels {
    fn default() -> Self {
        Self {
            show_window: "Show / Hide FerriVault".to_string(),
            open_generator: "Password Generator".to_string(),
            sync_vault: "Sync Vault Now".to_string(),
            lock_vault: "Lock Vault".to_string(),
            quit: "Quit FerriVault".to_string(),
        }
    }
}

/// Builds a native Tauri [`Menu`] from the provided [`TrayMenuLabels`].
pub fn build_tray_menu<R: Runtime>(
    app: &AppHandle<R>,
    labels: &TrayMenuLabels,
) -> Result<Menu<R>, AppError> {
    let show_item = MenuItem::with_id(
        app,
        "tray_show_hide",
        &labels.show_window,
        true,
        None::<&str>,
    )
    .map_err(|e| AppError::Internal(format!("Tray menu item error: {e}")))?;

    let sep1 = PredefinedMenuItem::separator(app)
        .map_err(|e| AppError::Internal(format!("Tray separator error: {e}")))?;

    let gen_item = MenuItem::with_id(
        app,
        "tray_generator",
        &labels.open_generator,
        true,
        None::<&str>,
    )
    .map_err(|e| AppError::Internal(format!("Tray menu item error: {e}")))?;

    let sync_item = MenuItem::with_id(app, "tray_sync", &labels.sync_vault, true, None::<&str>)
        .map_err(|e| AppError::Internal(format!("Tray menu item error: {e}")))?;

    let lock_item = MenuItem::with_id(app, "tray_lock", &labels.lock_vault, true, None::<&str>)
        .map_err(|e| AppError::Internal(format!("Tray menu item error: {e}")))?;

    let sep2 = PredefinedMenuItem::separator(app)
        .map_err(|e| AppError::Internal(format!("Tray separator error: {e}")))?;

    let quit_item = MenuItem::with_id(app, "tray_quit", &labels.quit, true, None::<&str>)
        .map_err(|e| AppError::Internal(format!("Tray menu item error: {e}")))?;

    Menu::with_items(
        app,
        &[
            &show_item, &sep1, &gen_item, &sync_item, &lock_item, &sep2, &quit_item,
        ],
    )
    .map_err(|e| AppError::Internal(format!("Failed to assemble tray menu: {e}")))
}

/// Toggles visibility and focus of the main application window.
pub fn toggle_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let is_visible = window.is_visible().unwrap_or(false);
        let is_minimized = window.is_minimized().unwrap_or(false);
        if is_visible && !is_minimized {
            let _ = window.hide();
        } else {
            let _ = window.unminimize();
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

/// Shows and focuses the main application window.
pub fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Initializes the system tray icon, menu, and event listeners on application startup.
pub fn setup_system_tray<R: Runtime>(app: &AppHandle<R>) -> Result<(), AppError> {
    let menu = build_tray_menu(app, &TrayMenuLabels::default())?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("FerriVault — Bitwarden Desktop Client")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app_handle, event| match event.id.as_ref() {
            "tray_show_hide" => {
                toggle_main_window(app_handle);
            }
            "tray_generator" => {
                show_main_window(app_handle);
                let _ = app_handle.emit("tray:open-generator", ());
            }
            "tray_sync" => {
                let _ = app_handle.emit("tray:sync-vault", ());
            }
            "tray_lock" => {
                let handle_clone = app_handle.clone();
                tauri::async_runtime::spawn(async move {
                    if let Some(state) = handle_clone.try_state::<AppState>() {
                        let mut guard = state.session.write().await;
                        if let Some(session) = guard.as_mut() {
                            session.lock();
                        }
                    }
                    let _ = handle_clone.emit("tray:vault-locked", ());
                });
            }
            "tray_quit" => {
                app_handle.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder
        .build(app)
        .map_err(|e| AppError::Internal(format!("Failed to build system tray icon: {e}")))?;

    Ok(())
}

/// Updates the native system tray menu labels when the user changes the application language.
pub fn update_tray_menu_labels<R: Runtime>(
    app: &AppHandle<R>,
    labels: &TrayMenuLabels,
) -> Result<(), AppError> {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let new_menu = build_tray_menu(app, labels)?;
        tray.set_menu(Some(new_menu))
            .map_err(|e| AppError::Internal(format!("Failed to update tray menu: {e}")))?;
    }
    Ok(())
}
