//! Rustwarden Tauri v2 library entrypoint.
//!
//! Initializes managed application state, sets up the native OS system tray icon,
//! intercepts the window close event when `close_to_tray` is enabled, and registers
//! all IPC commands.

pub mod api;
pub mod commands;
pub mod crypto;
pub mod error;
pub mod models;
pub mod state;
pub mod tray;

use tauri::{Manager, WindowEvent};

use crate::commands::{
    auth_cmd::{get_auth_status, lock_vault, login, logout, unlock_vault},
    settings_cmd::{get_settings, sync_tray_locale, update_settings},
    tools_cmd::{
        copy_to_clipboard, generate_passphrase_cmd, generate_password_cmd, generate_totp_cmd,
        open_external_url,
    },
    vault_cmd::{
        delete_cipher, delete_folder, get_vault_snapshot, permanent_delete_cipher, restore_cipher,
        save_cipher, save_folder, sync_vault,
    },
};
use crate::state::AppState;
use crate::tray::setup_system_tray;

/// Builds and runs the Tauri v2 desktop application.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .manage(AppState::new())
        .setup(|app| {
            let _ = setup_system_tray(app.handle());
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if let Some(state) = window.try_state::<AppState>() {
                    if state.should_close_to_tray() {
                        api.prevent_close();
                        let _ = window.hide();
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            login,
            unlock_vault,
            lock_vault,
            logout,
            get_auth_status,
            get_vault_snapshot,
            sync_vault,
            save_cipher,
            delete_cipher,
            restore_cipher,
            permanent_delete_cipher,
            save_folder,
            delete_folder,
            generate_password_cmd,
            generate_passphrase_cmd,
            generate_totp_cmd,
            copy_to_clipboard,
            open_external_url,
            get_settings,
            update_settings,
            sync_tray_locale,
        ]);

    if let Err(err) = builder.run(tauri::generate_context!()) {
        eprintln!("Error while running Rustwarden application: {err}");
    }
}
