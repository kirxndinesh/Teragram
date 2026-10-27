# Continue Teragram development on Windows

The repository contains the final shared Teragram source, including the gallery cache, bulk-upload refresh recovery, transfer-widget lifecycle, branding and folder-dialog refinements. The published v1.0 macOS app remains unchanged. A Windows installer has **not** been built or run on the current Mac; build and verify it on Windows before publishing it.

## Prerequisites

Use 64-bit Windows 10/11 and install:

1. [Git for Windows](https://git-scm.com/download/win).
2. [Node.js](https://nodejs.org/en/download) 22 or newer; CI uses Node 22.
3. [Rust with rustup](https://rustup.rs/), selecting the **MSVC x86_64** toolchain. CI uses Rust 1.92.0; the manifest requires at least Rust 1.92.
4. [Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with **Desktop development with C++**, the x64 MSVC tools and a Windows SDK.
5. [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/), if it is not already installed.

These are the [official Tauri Windows prerequisites](https://v2.tauri.app/start/prerequisites/#windows). Restart your terminal after installing them. Some native dependencies may also require CMake/NASM; use the C++ tools developer terminal if the linker or SDK cannot be found. FFmpeg is optional for conversion and thumbnail extraction paths; supported standard video playback uses the platform media engine.

## Clone and run

Sign in to GitHub with access to this private repository, then run in PowerShell:

```powershell
git clone https://github.com/kirxndinesh/Teragram.git
cd Teragram
rustup toolchain install 1.92.0
rustup override set 1.92.0
cd app
npm ci
npm run teragram:dev
```

The launcher selects the **Teragram profile** (`com.teragram.app`) and `tg-drive-local` feature. Prefer `teragram:dev` and `teragram:build` over bare `tauri dev/build`, which do not select all of that profile's overrides. An initial native compile can take several minutes.

This is the local-first desktop profile: metadata, settings, cache, transfer state
and credentials stay on the PC. It has no sponsor or checkout frontend and does
not require a supporter Worker to start. Telegram login and remote file transfers
still require Internet access. See [the profile and test scope](TG_DRIVE_LOCAL_PROFILE.md).

Telegram API credentials and sessions are not in the repository. Enter your own API ID/hash and sign in on Windows. Mac session databases, vault material and user media are not copied into the Windows checkout.

## Build an x64 NSIS installer

From the `app` folder:

```powershell
# Downloads the official Visual C++ runtime and checks its Microsoft signature.
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-windows-runtime.ps1
npm run teragram:build
```

The Windows launcher layers `tauri.teragram.windows.conf.json` over the shared Teragram profile. It packages the icon, WebView2 bootstrapper and verified Visual C++ prerequisite using the existing installer hooks. The runtime EXE is generated locally and ignored by Git.

The installer should appear in:

```text
app/src-tauri/target/release/bundle/nsis/*-setup.exe
```

This configuration does not enable signed automatic-updater artifacts. Without a configured trusted Windows signing identity, the installer is unsigned and Windows may display a SmartScreen warning. Do not describe a successful compile as full installed-app acceptance.

## Verify before a Windows release

```powershell
# From app:
npm run build:verify
npm run i18n:check
npx playwright install chromium
npm run teragram:test
npm run visual:test
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-windows-bundle.ps1

# From app/src-tauri:
cargo test --locked --features native-e2e --test native_e2e
cargo clippy --locked --features native-e2e --lib --all-targets -- -D warnings
cargo fmt --all -- --check
```

Use a disposable Windows account/VM for installer smoke tests. Do not set `GITHUB_ACTIONS=true` on your everyday account to bypass `smoke-windows-package.ps1`'s isolation guard. The manual **Teragram Windows build and verification** workflow in GitHub Actions performs the browser/native gates, runtime/installer inspection, isolated install-and-launch smoke test and checksum generation. It uploads a candidate artifact only after those steps pass; it does not publish a GitHub Release automatically.

Before publishing a Windows installer, also test the real installed UI: Telegram login/2FA, file/folder and drag-and-drop upload, pause/resume/retry, channel import, gallery navigation and sorting, documents, video seeking/subtitles, theme changes, restart/session persistence and uninstall/update behavior. Browser fixtures control the native/Telegram boundary and do not replace this acceptance.

## What is excluded

Native Android SDK projects, Gradle/Kotlin/Java sources, generated Android resources, Android packaging/signing scripts, credentials, session databases, personal media, node_modules and build outputs remain local. Eight documented compatibility files are included because the shared Windows application or verification graph imports them; see [the publication review](release/TERAGRAM_SOURCE_PUBLICATION.md). No Android build is configured by these instructions.
