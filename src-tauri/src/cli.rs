//! Command-Line Interface (CLI) mode for FerriVault.
//!
//! When `ferrivault` is invoked with a CLI subcommand (`status`, `login`, `sync`,
//! `list`, `get`, `totp`, `generate`, `lock`, `logout`, `--help`, `--version`),
//! execution stays in the terminal without launching GTK/WebKitGTK or opening a GUI window.

use std::io::{self, BufRead, Write};

use crate::api::{
    auth::{fetch_prelogin, login_with_password, refresh_access_token, VerificationParams},
    endpoints::{ServerEndpoints, ServerRegion},
    sync::fetch_sync,
};
use crate::commands::auth_cmd::decrypt_sync_response;
use crate::crypto::{
    enc_string::EncString,
    generator::{
        generate_passphrase, generate_password, PassphraseGeneratorOptions,
        PasswordGeneratorOptions,
    },
    kdf::{derive_master_key, derive_master_password_hash, stretch_master_key, KdfParams},
    keys::SymmetricCryptoKey,
    totp::generate_current_totp,
};
use crate::error::AppError;
use crate::models::cipher::CipherView;
use crate::state::{AppState, SessionData, VaultSnapshot};

/// Checks `std::env::args()` and, if a CLI subcommand or flag is present, executes it
/// and returns `Some(exit_code)`. Returns `None` when the normal GUI should start.
pub fn maybe_run_cli() -> Option<i32> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let first = args.first()?.as_str();

    // GUI-only flags such as `--minimized` should launch the desktop window, not CLI mode.
    if first == "--minimized" {
        return None;
    }

    let is_cli_invocation = matches!(
        first,
        "help"
            | "--help"
            | "-h"
            | "--version"
            | "-V"
            | "status"
            | "login"
            | "sync"
            | "list"
            | "ls"
            | "get"
            | "totp"
            | "generate"
            | "gen"
            | "lock"
            | "logout"
    );

    if !is_cli_invocation {
        return None;
    }

    let exit_code = match run_cli_command(&args) {
        Ok(()) => 0,
        Err(err) => {
            eprintln!("Error: {err}");
            1
        }
    };
    Some(exit_code)
}

fn print_help() {
    println!(
        "FerriVault {} — Fast, secure CLI & Desktop client for Bitwarden / Vaultwarden\n\n\
         USAGE:\n\
         \x20 ferrivault                     Launch desktop GUI\n\
         \x20 ferrivault --minimized         Launch desktop GUI hidden in system tray\n\
         \x20 ferrivault <COMMAND> [OPTIONS]\n\n\
         COMMANDS:\n\
         \x20 status                         Show current session, server, and device ID\n\
         \x20 login [OPTIONS]                Sign in to Bitwarden or Vaultwarden\n\
         \x20   --region <us|eu|custom>      Server region (default: us)\n\
         \x20   --url <URL>                  Custom server URL (implies --region custom)\n\
         \x20   --email <EMAIL>              Account email address\n\
         \x20 sync                           Sync encrypted vault from server\n\
         \x20 list [QUERY] [OPTIONS]         List vault items (alias: ls)\n\
         \x20   --type <login|note|card|id>  Filter by item type\n\
         \x20   --json                       Output JSON array\n\
         \x20 get <QUERY> [OPTIONS]          Retrieve a specific item by name, URI, or ID\n\
         \x20   --field <username|password|totp|notes|all>  Output a single field (default: all)\n\
         \x20   --json                       Output full item as JSON\n\
         \x20 totp <QUERY>                   Generate live 2FA code for a Login item\n\
         \x20 generate [OPTIONS]             Generate a secure password or passphrase (alias: gen)\n\
         \x20   --length <N>                 Password length (default: 20)\n\
         \x20   --no-symbols                 Exclude special symbols\n\
         \x20   --passphrase                 Generate EFF diceware passphrase\n\
         \x20   --words <N>                  Word count for passphrase (default: 5)\n\
         \x20 lock                           Lock session\n\
         \x20 logout                         Clear persisted session and tokens from disk\n\n\
         ENVIRONMENT:\n\
         \x20 FERRIVAULT_MASTER_PASSWORD     Optional non-interactive master password for scripts",
        env!("CARGO_PKG_VERSION")
    );
}

#[cfg(unix)]
struct TerminalEchoGuard {
    restore: bool,
}

#[cfg(unix)]
impl TerminalEchoGuard {
    fn disable_echo() -> Self {
        let status = std::process::Command::new("stty")
            .arg("-echo")
            .stdin(std::process::Stdio::inherit())
            .status();
        Self {
            restore: status.is_ok_and(|s| s.success()),
        }
    }
}

#[cfg(unix)]
impl Drop for TerminalEchoGuard {
    fn drop(&mut self) {
        if self.restore {
            let _ = std::process::Command::new("stty")
                .arg("echo")
                .stdin(std::process::Stdio::inherit())
                .status();
        }
    }
}

fn prompt_line(label: &str) -> Result<String, AppError> {
    eprint!("{label}");
    let _ = io::stderr().flush();
    let mut line = String::new();
    io::stdin()
        .lock()
        .read_line(&mut line)
        .map_err(|e| AppError::Internal(format!("Failed to read input: {e}")))?;
    Ok(line.trim().to_string())
}

fn prompt_master_password(label: &str) -> Result<String, AppError> {
    if let Ok(pw) = std::env::var("FERRIVAULT_MASTER_PASSWORD") {
        if !pw.is_empty() {
            return Ok(pw);
        }
    }

    eprint!("{label}");
    let _ = io::stderr().flush();

    #[cfg(unix)]
    let _guard = TerminalEchoGuard::disable_echo();

    let mut line = String::new();
    io::stdin()
        .lock()
        .read_line(&mut line)
        .map_err(|e| AppError::Internal(format!("Failed to read password: {e}")))?;

    #[cfg(unix)]
    eprintln!();

    let trimmed = line.trim_end_matches(&['\r', '\n'][..]).to_string();
    if trimmed.is_empty() {
        return Err(AppError::Validation("Master Password is required".into()));
    }
    Ok(trimmed)
}

fn run_cli_command(args: &[String]) -> Result<(), AppError> {
    let cmd = args[0].as_str();
    match cmd {
        "help" | "--help" | "-h" => {
            print_help();
            return Ok(());
        }
        "--version" | "-V" => {
            println!("ferrivault {}", env!("CARGO_PKG_VERSION"));
            return Ok(());
        }
        "generate" | "gen" => return handle_generate(&args[1..]),
        _ => {}
    }

    let rt = tokio::runtime::Runtime::new()
        .map_err(|e| AppError::Internal(format!("Failed to initialize async runtime: {e}")))?;
    let state = AppState::new();

    rt.block_on(async {
        match cmd {
            "status" => handle_status(&state).await,
            "lock" => {
                println!("Session locked (CLI holds no persistent plaintext keys).");
                Ok(())
            }
            "logout" => {
                {
                    let mut guard = state.session.write().await;
                    if let Some(mut s) = guard.take() {
                        s.lock();
                    }
                }
                state.persist().await;
                println!("Logged out and cleared persisted session.");
                Ok(())
            }
            "login" => handle_login(&state, &args[1..]).await,
            "sync" => {
                let snapshot = unlock_and_fetch_snapshot(&state).await?;
                println!(
                    "Synced vault for {} ({} items, {} folders, {} organizations, {} collections).",
                    snapshot.email,
                    snapshot.ciphers.len(),
                    snapshot.folders.len(),
                    snapshot.organizations.len(),
                    snapshot.collections.len()
                );
                Ok(())
            }
            "list" | "ls" => handle_list(&state, &args[1..]).await,
            "get" => handle_get(&state, &args[1..]).await,
            "totp" => handle_totp(&state, &args[1..]).await,
            _ => {
                print_help();
                Ok(())
            }
        }
    })
}

async fn handle_status(state: &AppState) -> Result<(), AppError> {
    let guard = state.session.read().await;
    println!("Device ID:  {}", state.device_id);
    match guard.as_ref() {
        Some(s) => {
            println!("Status:     Logged in (locked on disk)");
            println!("Email:      {}", s.email);
            println!("Server:     {}", s.endpoints.base_url);
        }
        None => {
            println!("Status:     Not logged in");
        }
    }
    Ok(())
}

async fn handle_login(state: &AppState, args: &[String]) -> Result<(), AppError> {
    let mut region = ServerRegion::OfficialUs;
    let mut custom_url: Option<String> = None;
    let mut email_arg: Option<String> = None;

    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--region" if i + 1 < args.len() => {
                region = match args[i + 1].to_lowercase().as_str() {
                    "eu" => ServerRegion::OfficialEu,
                    "custom" | "selfhosted" => ServerRegion::SelfHosted,
                    _ => ServerRegion::OfficialUs,
                };
                i += 2;
            }
            "--url" if i + 1 < args.len() => {
                region = ServerRegion::SelfHosted;
                custom_url = Some(args[i + 1].clone());
                i += 2;
            }
            "--email" if i + 1 < args.len() => {
                email_arg = Some(args[i + 1].clone());
                i += 2;
            }
            _ => i += 1,
        }
    }

    let email = match email_arg {
        Some(e) => e.trim().to_lowercase(),
        None => prompt_line("Email: ")?.to_lowercase(),
    };
    if email.is_empty() {
        return Err(AppError::Validation("Email is required".into()));
    }
    let master_password = prompt_master_password("Master Password: ")?;

    let endpoints = ServerEndpoints::resolve(region, custom_url.as_deref())?;
    let kdf_params = fetch_prelogin(&state.http_client, &endpoints, &email).await?;
    let master_key = derive_master_key(&master_password, &email, &kdf_params)?;
    let password_hash = derive_master_password_hash(&master_key, &master_password);
    let stretched_key = stretch_master_key(&master_key)?;

    let remembered_tf = {
        let tf_guard = state.two_factor_tokens.read().await;
        tf_guard.get(&email).cloned()
    };

    let first_attempt = login_with_password(
        &state.http_client,
        &endpoints,
        &email,
        &password_hash,
        &state.device_id,
        VerificationParams {
            two_factor_token: None,
            new_device_otp: None,
            remembered_two_factor_token: remembered_tf.as_deref(),
        },
    )
    .await;

    let token_resp = match first_attempt {
        Ok(resp) => resp,
        Err(AppError::TwoFactorRequired) => {
            let code = prompt_line("Two-Step Verification Code (2FA): ")?;
            login_with_password(
                &state.http_client,
                &endpoints,
                &email,
                &password_hash,
                &state.device_id,
                VerificationParams {
                    two_factor_token: Some(&code),
                    new_device_otp: None,
                    remembered_two_factor_token: remembered_tf.as_deref(),
                },
            )
            .await?
        }
        Err(AppError::NewDeviceVerificationRequired) => {
            let otp = prompt_line("New Device Verification Code (sent to your email): ")?;
            login_with_password(
                &state.http_client,
                &endpoints,
                &email,
                &password_hash,
                &state.device_id,
                VerificationParams {
                    two_factor_token: None,
                    new_device_otp: Some(&otp),
                    remembered_two_factor_token: remembered_tf.as_deref(),
                },
            )
            .await?
        }
        Err(e) => return Err(e),
    };

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
            .ok_or_else(|| AppError::Crypto("Server did not return a user symmetric key".into()))?
    };

    let enc = EncString::parse(&protected_key)?;
    let raw_key_bytes = enc.decrypt_bytes(&stretched_key)?;
    let vault_key = SymmetricCryptoKey::from_slice(&raw_key_bytes)?;
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
            email: email.clone(),
            endpoints,
            kdf_params: effective_kdf,
            access_token: token_resp.access_token,
            refresh_token: token_resp.refresh_token,
            protected_symmetric_key: protected_key,
            last_encrypted_sync: None,
            vault_key: None,
            decrypted_snapshot: None,
        });
    }
    state.persist().await;

    println!(
        "Signed in as {} ({} items synced and session saved).",
        email,
        snapshot.ciphers.len()
    );
    Ok(())
}

async fn unlock_and_fetch_snapshot(state: &AppState) -> Result<VaultSnapshot, AppError> {
    let master_password = prompt_master_password("Master Password: ")?;

    let mut token_refreshed = false;
    let snapshot = {
        let mut session_guard = state.session.write().await;
        let session = session_guard.as_mut().ok_or_else(|| {
            AppError::Validation("No active session. Run `ferrivault login` first.".into())
        })?;

        let master_key = derive_master_key(&master_password, &session.email, &session.kdf_params)?;
        let stretched_key = stretch_master_key(&master_key)?;
        let enc = EncString::parse(&session.protected_symmetric_key)?;
        let raw_key_bytes = enc.decrypt_bytes(&stretched_key)?;
        let vault_key = SymmetricCryptoKey::from_slice(&raw_key_bytes)?;

        let sync_resp = match fetch_sync(
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
        };

        decrypt_sync_response(
            &session.email,
            &session.endpoints.base_url,
            &sync_resp,
            &vault_key,
        )
    };

    if token_refreshed {
        state.persist().await;
    }

    Ok(snapshot)
}

async fn handle_list(state: &AppState, args: &[String]) -> Result<(), AppError> {
    let mut query = String::new();
    let mut type_filter: Option<u8> = None;
    let mut as_json = false;

    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--json" => {
                as_json = true;
                i += 1;
            }
            "--type" if i + 1 < args.len() => {
                type_filter = match args[i + 1].to_lowercase().as_str() {
                    "login" => Some(1),
                    "note" | "notes" => Some(2),
                    "card" => Some(3),
                    "id" | "identity" => Some(4),
                    _ => None,
                };
                i += 2;
            }
            val if !val.starts_with('-') => {
                query = val.to_lowercase();
                i += 1;
            }
            _ => i += 1,
        }
    }

    let snapshot = unlock_and_fetch_snapshot(state).await?;
    let matches: Vec<&CipherView> = snapshot
        .ciphers
        .iter()
        .filter(|c| c.deleted_date.is_none())
        .filter(|c| match type_filter {
            None => true,
            Some(tf) => c.r#type == tf,
        })
        .filter(|c| {
            if query.is_empty() {
                return true;
            }
            c.name.to_lowercase().contains(&query)
                || c.login
                    .as_ref()
                    .and_then(|l| l.username.as_deref())
                    .is_some_and(|u| u.to_lowercase().contains(&query))
                || c.login
                    .as_ref()
                    .is_some_and(|l| l.uris.iter().any(|u| u.uri.to_lowercase().contains(&query)))
        })
        .collect();

    if as_json {
        let json = serde_json::to_string_pretty(&matches)
            .map_err(|e| AppError::Internal(e.to_string()))?;
        println!("{json}");
        return Ok(());
    }

    if matches.is_empty() {
        println!("No matching items found.");
        return Ok(());
    }

    println!("{:<10} {:<28} {:<28}", "TYPE", "NAME", "USERNAME / INFO");
    println!("{:-<10} {:-<28} {:-<28}", "", "", "");
    for item in matches {
        let kind = match item.r#type {
            1 => "Login",
            2 => "Note",
            3 => "Card",
            4 => "Identity",
            _ => "Other",
        };
        let subtitle = item
            .login
            .as_ref()
            .and_then(|l| l.username.as_deref())
            .or_else(|| item.card.as_ref().and_then(|c| c.brand.as_deref()))
            .or_else(|| item.identity.as_ref().and_then(|id| id.email.as_deref()))
            .unwrap_or("");
        println!("{:<10} {:<28} {}", kind, item.name, subtitle);
    }
    Ok(())
}

fn find_single_cipher<'a>(
    ciphers: &'a [CipherView],
    query: &str,
) -> Result<&'a CipherView, AppError> {
    let q = query.trim().to_lowercase();
    if q.is_empty() {
        return Err(AppError::Validation("Item query is required".into()));
    }

    // Exact ID or exact case-insensitive name match first
    if let Some(exact) = ciphers
        .iter()
        .find(|c| c.deleted_date.is_none() && (c.id == query || c.name.to_lowercase() == q))
    {
        return Ok(exact);
    }

    ciphers
        .iter()
        .find(|c| {
            c.deleted_date.is_none()
                && (c.name.to_lowercase().contains(&q)
                    || c.login
                        .as_ref()
                        .and_then(|l| l.username.as_deref())
                        .is_some_and(|u| u.to_lowercase().contains(&q))
                    || c.login
                        .as_ref()
                        .is_some_and(|l| l.uris.iter().any(|u| u.uri.to_lowercase().contains(&q))))
        })
        .ok_or_else(|| AppError::Validation(format!("No item found matching '{query}'")))
}

async fn handle_get(state: &AppState, args: &[String]) -> Result<(), AppError> {
    let mut query: Option<String> = None;
    let mut field = "all".to_string();
    let mut as_json = false;

    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--json" => {
                as_json = true;
                i += 1;
            }
            "--field" if i + 1 < args.len() => {
                field = args[i + 1].to_lowercase();
                i += 2;
            }
            val if !val.starts_with('-') && query.is_none() => {
                query = Some(val.to_string());
                i += 1;
            }
            _ => i += 1,
        }
    }

    let q = query.ok_or_else(|| AppError::Validation("Usage: ferrivault get <query>".into()))?;
    let snapshot = unlock_and_fetch_snapshot(state).await?;
    let item = find_single_cipher(&snapshot.ciphers, &q)?;

    if as_json {
        let json =
            serde_json::to_string_pretty(item).map_err(|e| AppError::Internal(e.to_string()))?;
        println!("{json}");
        return Ok(());
    }

    match field.as_str() {
        "username" | "user" => {
            let val = item
                .login
                .as_ref()
                .and_then(|l| l.username.as_deref())
                .unwrap_or("");
            println!("{val}");
        }
        "password" | "pass" => {
            let val = item
                .login
                .as_ref()
                .and_then(|l| l.password.as_deref())
                .unwrap_or("");
            println!("{val}");
        }
        "totp" => {
            let secret = item
                .login
                .as_ref()
                .and_then(|l| l.totp.as_deref())
                .ok_or_else(|| AppError::Validation("Item has no TOTP secret".into()))?;
            let totp = generate_current_totp(secret)?;
            println!("{}", totp.code);
        }
        "notes" => {
            println!("{}", item.notes.as_deref().unwrap_or(""));
        }
        _ => {
            println!("Name:     {}", item.name);
            println!("ID:       {}", item.id);
            if let Some(login) = &item.login {
                if let Some(u) = &login.username {
                    println!("Username: {u}");
                }
                if let Some(p) = &login.password {
                    println!("Password: {p}");
                }
                if let Some(secret) = &login.totp {
                    if let Ok(totp) = generate_current_totp(secret) {
                        println!(
                            "TOTP:     {} ({}s remaining)",
                            totp.code, totp.remaining_seconds
                        );
                    }
                }
                for u in &login.uris {
                    println!("URI:      {}", u.uri);
                }
            }
            if let Some(notes) = &item.notes {
                if !notes.is_empty() {
                    println!("Notes:\n{notes}");
                }
            }
        }
    }

    Ok(())
}

async fn handle_totp(state: &AppState, args: &[String]) -> Result<(), AppError> {
    let query = args
        .first()
        .ok_or_else(|| AppError::Validation("Usage: ferrivault totp <query>".into()))?;
    let snapshot = unlock_and_fetch_snapshot(state).await?;
    let item = find_single_cipher(&snapshot.ciphers, query)?;
    let secret = item
        .login
        .as_ref()
        .and_then(|l| l.totp.as_deref())
        .ok_or_else(|| AppError::Validation(format!("'{}' has no TOTP secret", item.name)))?;
    let totp = generate_current_totp(secret)?;
    println!("{} ({}s remaining)", totp.code, totp.remaining_seconds);
    Ok(())
}

fn handle_generate(args: &[String]) -> Result<(), AppError> {
    let mut is_passphrase = false;
    let mut length = 20usize;
    let mut words = 5usize;
    let mut symbols = true;

    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--passphrase" => {
                is_passphrase = true;
                i += 1;
            }
            "--no-symbols" => {
                symbols = false;
                i += 1;
            }
            "--length" if i + 1 < args.len() => {
                length = args[i + 1].parse().unwrap_or(20);
                i += 2;
            }
            "--words" if i + 1 < args.len() => {
                words = args[i + 1].parse().unwrap_or(5);
                i += 2;
            }
            _ => i += 1,
        }
    }

    if is_passphrase {
        let phrase = generate_passphrase(&PassphraseGeneratorOptions {
            num_words: words,
            word_separator: "-".to_string(),
            capitalize: true,
            include_number: true,
        })?;
        println!("{phrase}");
    } else {
        let pw = generate_password(&PasswordGeneratorOptions {
            length,
            uppercase: true,
            lowercase: true,
            numbers: true,
            symbols,
            min_numbers: 1,
            min_symbols: if symbols { 1 } else { 0 },
            avoid_ambiguous: false,
        })?;
        println!("{pw}");
    }

    Ok(())
}
