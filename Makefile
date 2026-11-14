# ==============================================================================
# FerriVault — Project Makefile
# ==============================================================================

.DEFAULT_GOAL := help

NPM := npm
CARGO := cargo
TAURI_MANIFEST := src-tauri/Cargo.toml

.PHONY: help setup install dev dev-frontend build build-frontend build-debug \
        test test-rust test-i18n lint lint-rust lint-frontend fmt fmt-check \
        check clean

## Display all available Make targets
help:
	@echo ""
	@echo "FerriVault — Available Commands:"
	@echo "----------------------------------------------------------------------"
	@echo "  make setup           Install npm dependencies and fetch Rust crates"
	@echo "  make dev             Run the Tauri desktop app in development mode"
	@echo "  make dev-frontend    Run only the Vite frontend dev server"
	@echo "  make build           Build production desktop packages/installers"
	@echo "  make build-debug     Build desktop application in debug mode"
	@echo "  make build-frontend  Typecheck and bundle the React frontend"
	@echo "  make test            Run all tests (Rust unit tests + i18n parity)"
	@echo "  make test-rust       Run Cargo unit and doc tests"
	@echo "  make test-i18n       Verify translation key parity (en, es, ca)"
	@echo "  make lint            Run Clippy and TypeScript typechecking"
	@echo "  make fmt             Format Rust code with rustfmt"
	@echo "  make fmt-check       Check Rust formatting without modifying files"
	@echo "  make check           Run full verification suite (fmt-check + lint + test + build-frontend)"
	@echo "  make clean           Remove build artifacts (dist/ and src-tauri/target/)"
	@echo ""

## Install frontend dependencies and prefetch Rust crates
setup: install
	$(CARGO) fetch --manifest-path $(TAURI_MANIFEST)

## Install npm packages
install:
	$(NPM) install

## Launch the full Tauri desktop application in hot-reload development mode
dev:
	$(NPM) run tauri dev

## Launch only the Vite frontend server (http://localhost:1420)
dev-frontend:
	$(NPM) run dev

## Build production desktop application bundles
build:
	$(NPM) run tauri build

## Build desktop application in debug mode
build-debug:
	$(NPM) run tauri build -- --debug

## Typecheck and build the frontend assets into dist/
build-frontend:
	$(NPM) run build

## Run all automated tests (Rust unit tests + i18n locale parity)
test: test-i18n test-rust

## Run Rust unit tests
test-rust:
	$(CARGO) test --manifest-path $(TAURI_MANIFEST)

## Verify 100% key parity across all src/i18n/locales/*.json files
test-i18n:
	$(NPM) run test:i18n

## Run static analysis and linters across backend and frontend
lint: lint-rust lint-frontend

## Run Clippy with warnings denied on the Rust backend
lint-rust:
	$(CARGO) clippy --manifest-path $(TAURI_MANIFEST) --lib --bins -- -D warnings

## Run TypeScript strict compiler check
lint-frontend:
	npx tsc --noEmit

## Format Rust source files
fmt:
	$(CARGO) fmt --manifest-path $(TAURI_MANIFEST)

## Verify Rust code formatting
fmt-check:
	$(CARGO) fmt --manifest-path $(TAURI_MANIFEST) -- --check

## Run the complete pre-commit verification suite
check: fmt-check lint test build-frontend

## Clean frontend and Rust build outputs
clean:
	rm -rf dist
	$(CARGO) clean --manifest-path $(TAURI_MANIFEST)
