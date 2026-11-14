//! Cross-platform launch-on-startup management (Linux XDG autostart, macOS LaunchAgents, Windows Registry).

use std::path::PathBuf;

use crate::error::AppError;

/// Resolves the executable path to register for autostart.
/// On Linux AppImage builds, prefers `$APPIMAGE` over the ephemeral `/tmp/.mount_*` path.
fn resolve_executable_path() -> Result<String, AppError> {
    #[cfg(target_os = "linux")]
    if let Ok(appimage) = std::env::var("APPIMAGE") {
        if !appimage.trim().is_empty() {
            return Ok(appimage);
        }
    }

    let exe = std::env::current_exe()
        .map_err(|e| AppError::Internal(format!("Failed to resolve executable path: {e}")))?;
    Ok(exe.to_string_lossy().into_owned())
}

/// Enables or disables automatic launch of FerriVault at OS user login.
pub fn set_autostart(enabled: bool, start_minimized: bool) -> Result<(), AppError> {
    let exe_path = resolve_executable_path()?;

    #[cfg(target_os = "linux")]
    {
        let config_dir = std::env::var("XDG_CONFIG_HOME")
            .ok()
            .filter(|s| !s.trim().is_empty())
            .map(PathBuf::from)
            .or_else(|| {
                std::env::var("HOME")
                    .ok()
                    .filter(|s| !s.trim().is_empty())
                    .map(|h| PathBuf::from(h).join(".config"))
            })
            .ok_or_else(|| AppError::Internal("Could not resolve XDG config directory".into()))?;

        let autostart_dir = config_dir.join("autostart");
        let desktop_file = autostart_dir.join("ferrivault.desktop");

        if !enabled {
            if desktop_file.exists() {
                std::fs::remove_file(&desktop_file)?;
            }
            return Ok(());
        }

        std::fs::create_dir_all(&autostart_dir)?;
        let exec_line = if start_minimized {
            format!("\"{exe_path}\" --minimized")
        } else {
            format!("\"{exe_path}\"")
        };
        let contents = format!(
            "[Desktop Entry]\n\
             Type=Application\n\
             Version=1.0\n\
             Name=FerriVault\n\
             Comment=Secure Desktop Client for Bitwarden & Vaultwarden\n\
             Exec={exec_line}\n\
             Icon=ferrivault\n\
             Terminal=false\n\
             Categories=Utility;Security;\n\
             X-GNOME-Autostart-enabled=true\n"
        );
        std::fs::write(&desktop_file, contents)?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME")
            .ok()
            .filter(|s| !s.trim().is_empty())
            .ok_or_else(|| AppError::Internal("Could not resolve HOME directory".into()))?;
        let agents_dir = PathBuf::from(home).join("Library").join("LaunchAgents");
        let plist_path = agents_dir.join("app.ferrivault.desktop.plist");

        if !enabled {
            if plist_path.exists() {
                std::fs::remove_file(&plist_path)?;
            }
            return Ok(());
        }

        std::fs::create_dir_all(&agents_dir)?;
        let minimized_arg = if start_minimized {
            "    <string>--minimized</string>\n"
        } else {
            ""
        };
        let plist = format!(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
             <!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n\
             <plist version=\"1.0\">\n\
             <dict>\n\
               <key>Label</key>\n\
               <string>app.ferrivault.desktop</string>\n\
               <key>ProgramArguments</key>\n\
               <array>\n\
                 <string>{exe_path}</string>\n\
             {minimized_arg}\
               </array>\n\
               <key>RunAtLoad</key>\n\
               <true/>\n\
             </dict>\n\
             </plist>\n"
        );
        std::fs::write(&plist_path, plist)?;
        return Ok(());
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;

        const RUN_KEY: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
        if !enabled {
            let _ = Command::new("reg")
                .args(["delete", RUN_KEY, "/v", "FerriVault", "/f"])
                .output();
            return Ok(());
        }

        let value = if start_minimized {
            format!("\"{exe_path}\" --minimized")
        } else {
            format!("\"{exe_path}\"")
        };
        let status = Command::new("reg")
            .args([
                "add",
                RUN_KEY,
                "/v",
                "FerriVault",
                "/t",
                "REG_SZ",
                "/d",
                &value,
                "/f",
            ])
            .status()
            .map_err(|e| AppError::Internal(format!("Failed to update Windows registry: {e}")))?;

        if !status.success() {
            return Err(AppError::Internal(
                "Windows registry autostart update failed".into(),
            ));
        }
        return Ok(());
    }

    #[allow(unreachable_code)]
    Ok(())
}
