# Development & Build Guide

This document describes the prerequisites, `Makefile` targets, and verification workflows for developing and packaging **Rustwarden**.

---

## 1. System Prerequisites

- **Rust Toolchain**: `rustc` and `cargo` (`1.77+`)
- **Node.js**: `v20+` and `npm`
- **Linux System Libraries** (for Tauri v2 WebKitGTK & System Tray):
  - Debian / Ubuntu:
    ```bash
    sudo apt update
    sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file \
      libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev patchelf
    ```
  - Fedora:
    ```bash
    sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file \
      libappindicator-gtk3-devel librsvg2-devel
    ```
  - Arch Linux:
    ```bash
    sudo pacman -S --needed webkit2gtk-4.1 base-devel curl wget file openssl \
      appmenu-gtk-module libappindicator-gtk3 librsvg
    ```

---

## 2. Makefile Workflow Reference

All common operations are available through the root `Makefile`:

| Command | Description |
| :--- | :--- |
| `make help` | Show all available Make targets and descriptions |
| `make setup` | Install `npm` dependencies and prefetch Rust crates |
| `make dev` | Start the Tauri desktop app in development mode with hot-reload |
| `make dev-frontend` | Start only the Vite frontend server on `http://localhost:1420` |
| `make build` | Build production desktop application bundles/installers |
| `make build-debug` | Build desktop binary with debug symbols |
| `make build-frontend` | Run TypeScript typechecking and Vite production bundle |
| `make test` | Run all tests (`test-i18n` + `test-rust`) |
| `make test-rust` | Run Rust unit tests in `src-tauri/` |
| `make test-i18n` | Verify 100% translation key parity across `en`, `es`, and `ca` |
| `make lint` | Run `cargo clippy -- -D warnings` and `tsc --noEmit` |
| `make fmt` | Format all Rust code using `cargo fmt` |
| `make check` | Full pre-commit verification (`fmt-check` + `lint` + `test` + `build-frontend`) |
| `make clean` | Clean `dist/` and `src-tauri/target/` build artifacts |
