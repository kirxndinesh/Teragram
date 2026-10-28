# Teragram updater security patch

Source: tauri-plugin-updater 2.10.1 from static.crates.io, verified against the repository Cargo.lock SHA-256 806d9dac662c2e4594ff03c647a552f2c9bd544e7d0f683ec58f872f952ce4af. Original MIT and Apache-2.0 licenses are retained.

Local change: Cargo.toml selects ZIP 9.1.2 instead of ZIP 4 to address RUSTSEC-2026-0367, RUSTSEC-2026-0368 and RUSTSEC-2026-0369. The published updater still selects ZIP 4, so this patch keeps the existing updater API and signature verification while using the fixed archive implementation. No updater runtime Rust or JavaScript logic is changed. The upstream inline unit-test module is omitted under this repository's E2E-only policy; application-boundary verification remains in the native and packaging suites. Remove the patch when upstream supports the fixed ZIP release.

The published crate Cargo.lock is omitted because this library uses the application lockfile.
