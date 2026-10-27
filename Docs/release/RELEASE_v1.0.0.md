<img src="https://github.com/kirxndinesh/Teragram/raw/main/Docs/assets/teragram-logo.svg" alt="Teragram" width="80">

# Teragram v1.0 — macOS Apple Silicon preview

A Telegram-powered workspace for your photos and files, with a natural gallery, channel-backed folders and a focused file manager.

## Downloads

- **Teragram_1.0.0_macos_arm64.dmg** — open and drag Teragram into Applications.
- **Teragram_1.0.0_macos_arm64.app.zip** — extract and move Teragram.app into Applications.
- **SHA256SUMS.txt** — SHA-256 checksums for the application and logo assets.
- **Teragram_Logo.png / .svg** — the Teragram brand mark.

This build is for **Apple Silicon Macs (ARM64)**. Windows, Intel macOS and Android installers are not part of this release. The app is ad-hoc signed and **has no Apple Developer ID signing or notarization**, so macOS may ask you to approve it explicitly. This release does not include a signed automatic-updater feed.

## Highlights

- Photos gallery across allocated folders, instant cached navigation, remembered scroll positions, filters, sort and thumbnail sizing.
- My Cloud, a dedicated Folders overview, linked existing Telegram channels and a compact collapsible sidebar.
- Floating image/video previews, subtitle import, PDF and text/code viewing, and creative-file thumbnail fallbacks where supported.
- File/folder pickers, drag-and-drop uploads, persistent transfer queues and pause/resume/retry controls.
- Completed transfer widgets confirm success briefly, then disappear. Paused and failed transfers stay visible; dismissal preserves transfer history.
- Neutral dark/light themes, custom accent colors and refined channel import/folder creation dialogs.
- Local-only diagnostics in the Teragram macOS profile and profile-based Settings access.

## Bulk-upload fix in this build

Concurrent uploads could change an index while Photos or a folder was reading it, incorrectly showing “This operation could not finish. Refresh your library and retry.” after successful uploads. Transient generation conflicts now retry with bounded backoff, inventory notifications are batched, in-flight reads are retained and a final refresh catches later changes. Cached media stays visible. Account, vault, invalid-pagination and integrity failures are still handled as failures.

## Setup and limits

Obtain your own Telegram API ID/hash from [my.telegram.org](https://my.telegram.org), enter them locally, then sign in with your Telegram account. No API secrets, sessions, user media or vault keys are bundled. Telegram service/account/file limits still apply. Keep independent backups. Some conversion/thumbnail paths require FFmpeg; available playback and embedded media tracks depend on the source codec and the macOS media engine.

## Verification

- **123 desktop browser E2E journeys passed**, including bulk-upload index conflicts, a 175-event refresh burst, gallery caching, account/vault boundaries, dialogs, previews and transfer-widget lifecycle.
- Production TypeScript/frontend build, localization, security configuration, workflow pin protections, test policy and unchanged bundle budgets passed.
- Optimized macOS application bundle built locally. Browser tests control native/Telegram boundaries; they do not certify every real Telegram account, codec or network.

Developed by **Kiran Dinesh (@kirxndinesh)**. [Repository](https://github.com/kirxndinesh/Teragram) · [Issues](https://github.com/kirxndinesh/Teragram/issues)


### Source publication status

This initial preview release publishes the macOS application and branded documentation. The full tested source snapshot remains staged locally pending the owner's explicit approval of eight shared compatibility files required by the repository publication policy. The automatically generated GitHub source archives currently contain documentation, not the full app source.
