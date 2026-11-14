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

/// Ensures that on Linux (especially Wayland compositors like KDE KWin and GNOME Mutter,
/// which resolve window titlebar/taskbar icons from `.desktop` entries matching the
/// Wayland `app_id` rather than X11 `_NET_WM_ICON`), the user's `~/.local/share` has
/// the Rustwarden icon and `.desktop` metadata installed even during `cargo tauri dev`.
#[cfg(target_os = "linux")]
fn ensure_linux_desktop_icon() {
    use std::path::PathBuf;

    let data_home = std::env::var("XDG_DATA_HOME")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .map(PathBuf::from)
        .or_else(|| {
            std::env::var("HOME")
                .ok()
                .filter(|s| !s.trim().is_empty())
                .map(|h| PathBuf::from(h).join(".local").join("share"))
        });

    let Some(base_dir) = data_home else {
        return;
    };

    let icon_dir = base_dir
        .join("icons")
        .join("hicolor")
        .join("128x128")
        .join("apps");
    let apps_dir = base_dir.join("applications");

    let _ = std::fs::create_dir_all(&icon_dir);
    let _ = std::fs::create_dir_all(&apps_dir);

    let icon_bytes = include_bytes!("../icons/128x128.png");
    let icon_path = icon_dir.join("rustwarden.png");
    let _ = std::fs::write(&icon_path, icon_bytes);
    let _ = std::fs::write(icon_dir.join("com.rustwarden.desktop.png"), icon_bytes);

    let icon_path_str = icon_path.to_string_lossy();
    let exec_path = std::env::current_exe()
        .ok()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_else(|| "rustwarden".to_string());

    let desktop_contents = format!(
        "[Desktop Entry]\n\
         Type=Application\n\
         Name=Rustwarden\n\
         Comment=Secure Desktop Client for Bitwarden & Vaultwarden\n\
         Exec=\"{exec_path}\"\n\
         Icon={icon_path_str}\n\
         Terminal=false\n\
         Categories=Utility;Security;\n\
         StartupWMClass=rustwarden\n"
    );

    let _ = std::fs::write(apps_dir.join("rustwarden.desktop"), &desktop_contents);
    let _ = std::fs::write(
        apps_dir.join("com.rustwarden.desktop.desktop"),
        &desktop_contents,
    );
}

/// Builds and runs the Tauri v2 desktop application.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    ensure_linux_desktop_icon();

    let builder = tauri::Builder::default()
        .manage(AppState::new())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                if let Some(icon) = app.default_window_icon() {
                    let _ = window.set_icon(icon.clone());
                }
            }
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
