# Teragram

A desktop workspace for files stored in Telegram channels and Saved Messages.
The redesigned interface uses a seamless Photos-style workspace, locally bundled
Inter and customizable accents. Light, neutral charcoal Dark and System modes
apply immediately and persist across launches.

The two-column workspace includes pill navigation, a structured file manager,
and a compact sidebar storage widget with a detailed category popover. Photos combines images and videos across
account-specific allocated folders in a masonry gallery. Plain clicks preview;
checkboxes and modifier clicks select. Previews open in a floating glass window,
with explicit fullscreen and animated entrance, navigation and dismissal. Bulk operations preserve each file's
source folder, including when different channels use the same message ID.

Settings retains the existing Telegram, transfer, vault, sync and local-service
controls, and adds startup view, thumbnail scaling, download directory and photo
allocations. Advertising and promotional prompts are removed from the app.

## Run

```sh
cd app
npm ci
npm run tg:dev
```

Build with `npm run tg:build`. On macOS the local debug application is
`app/src-tauri/target/debug/bundle/macos/Teragram.app`. The launcher uses the
workspace-local Rust toolchain in `.build-tools/` when present. Otherwise use
Rust 1.92+ and the platform's Tauri 2 prerequisites. Node 22+ is required.

Use the `tg:` launchers to select both the isolated Tauri identity and credential
namespace. Existing Teragram sessions, credentials, vaults and settings are
not migrated. Complete Telegram API credential entry and QR/phone sign-in in the
app; keep credentials and login codes out of chat.

## Validation

```sh
cd app
npm run build:verify
npm run i18n:check
npm run tg:test
```

Set `TG_DRIVE_BROWSER` to a locally installed Chromium executable if Playwright's
browser is unavailable. The 49 targeted journeys cover authentication, 2FA,
account isolation, vault invalidation, transfers, search, sync settings, photo
allocation persistence, preview/selection behavior and duplicate message IDs.
The dashboard and Photos views pass axe audits in both themes and fit 1000- and
1440-pixel widths. Production build, bundle budgets, locale checks, native Rust
check, formatting, security configuration and E2E policy checks pass.

Two targeted native process/HTTP journeys verify removed ad routes and media
server port fallback.
The macOS debug bundle builds locally. Browser journeys simulate the native/Telegram
boundary, while one player journey decodes a real locally generated MP4 over
Range HTTP responses and checks seeking, mute/volume, speed and HUD hiding.
The desktop app has also connected to the existing Telegram session. A live
upload/download round trip and encryption recovery remain separate acceptance
steps; these UI checks do not establish those outcomes.

Nine native preview/cache journeys also pass, including real raster decoding,
high-DPI dimensions, REST thumbnail caching, ownership/protection checks and
controlled HEIC/video fallback processes. A broader optional video-upload codec
journey reports `VIDEO_THUMBNAIL_UNAVAILABLE` because FFmpeg is absent; it is not
counted as passed. No live upload or remote file rename/delete was performed.

## Notes

- [UI architecture and removal audit](Docs/TG_DRIVE_UI_AUDIT.md)
- [Architecture and live acceptance](Docs/TG_DRIVE_ARCHITECTURE.md)
- [Isolated local profile](Docs/TG_DRIVE_LOCAL_PROFILE.md)
- [Design and validation](Docs/TG_DRIVE_DESIGN.md)

Upstream: <https://github.com/caamer20/Telegram-Drive>, commit
`cdf799ab82473bcdfbd3e0d7195654420951d1d5`. Original author attribution and
historical documentation are retained. `packaging/arch/UPSTREAM-LICENSE-NOTICE`
records the absence of a source license grant; this local adaptation does not
establish redistribution rights.
