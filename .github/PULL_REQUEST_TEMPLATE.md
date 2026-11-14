## Summary

<!-- Describe what this PR does and why it is needed. -->

## Related Issue

<!-- Link the issue this PR addresses, e.g. Closes #123 -->

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] UI / Theme / Localization update
- [ ] Documentation / CI / Refactor

## Testing & Verification

<!-- Describe how you tested these changes (e.g. Bitwarden US/EU, self-hosted Vaultwarden, Linux/Wayland, Windows, macOS). -->

## Checklist

- [ ] `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` passes
- [ ] `cargo clippy --manifest-path src-tauri/Cargo.toml --lib --bins -- -D warnings` passes
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml` passes
- [ ] `npx tsc --noEmit` and `npm run build` pass
- [ ] `npm run test:i18n` passes (`en.json`, `es.json`, and `ca.json` have 100% key parity)
- [ ] No `.unwrap()` / `.expect()` introduced in production Rust code
- [ ] No hardcoded user-facing strings in UI components (all text uses `useTranslation()`)
- [ ] All code, comments, and docstrings are written in English

## Screenshots (if applicable)

<!-- Add before/after screenshots for UI changes. -->
