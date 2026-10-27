<div align="center">
  <img src="Docs/assets/teragram-logo.svg" width="96" height="96" alt="Teragram logo">

# Teragram

### Your photos and files, together in a Telegram-powered workspace.

A macOS app combining a natural media gallery with a practical cloud file manager. Browse Saved Messages and linked Telegram channels, organize folders, preview documents, and manage transfers from one calm workspace.

[Download for macOS](https://github.com/kirxndinesh/Teragram/releases/tag/v1.0.0-macos-preview) · [Release notes](https://github.com/kirxndinesh/Teragram/releases) · [Report an issue](https://github.com/kirxndinesh/Teragram/issues)

**v1.0 · macOS Apple Silicon · React + Tauri + Rust**
</div>

## What Teragram does

- **Photos:** a masonry gallery across allocated folders, responsive thumbnail sizing, folder filters, sorting, favorites and multi-select.
- **Files:** My Cloud, a selectable Folders overview, linked Telegram channels, category pills and structured list/grid views.
- **Previews:** a floating image lightbox, video playback and seeking, subtitle import, PDF and text/code viewers, plus creative-file thumbnail fallbacks where supported.
- **Transfers:** file/folder pickers, drag and drop, Saved Messages as the global-view upload destination, durable queues, pause/resume/retry and completion feedback that dismisses automatically.
- **Fast navigation:** session thumbnail/index caches preserve ready media and view positions. Bulk uploads batch index refreshes and recover from concurrent index changes.
- **Personalization:** light, neutral dark and system appearance, custom accent colors, thumbnail sizing and a collapsible sidebar.
- **Local control:** on-device metadata, cache management, local diagnostics, folder sync and optional client-side encryption.

Teragram connects directly to your own Telegram account. Storage remains subject to Telegram's service, account and per-file limits. Teragram is independent of Telegram and is not an official Telegram product.

## Install on macOS

1. Open [Releases](https://github.com/kirxndinesh/Teragram/releases) and download the Apple Silicon `.dmg` or `.app.zip`.
2. Open the disk image and drag **Teragram** into **Applications**, or extract the ZIP and move `Teragram.app` there.
3. Launch Teragram and complete Telegram setup.

The initial macOS release is a preview build without Apple Developer ID signing/notarization. Gatekeeper may require explicit approval. The assets are ARM64; Intel, Windows and Android distributions are not included in this release. SHA-256 checksums accompany the downloads. Some codec conversion and thumbnail extraction paths require a separately installed FFmpeg.

## Connect Telegram

Telegram requires an application API ID and API hash. They are not bundled or published.

1. Obtain your own application credentials from [my.telegram.org](https://my.telegram.org).
2. Enter them locally in Teragram and sign in using your phone/login code and, when enabled, your Telegram cloud password. QR login remains available where supported.
3. Browse **Saved Messages**, create a private channel-backed folder or use **Add Existing Channel** in Folders.
4. Choose which folders feed Photos using its allocation control.

Never share API hashes, login codes, session databases, vault keys or recovery material in issues. Ordinary uploads are stored normally in Telegram; optional encrypted uploads protect the file contents locally before transfer. Keep independent backups of important files.

## Source publication

This repository currently hosts the branded documentation and macOS release. The complete tested source snapshot is staged locally, pending the owner's approval of eight compatibility files under the repository's Android publication policy. See [the exact file review](Docs/release/TERAGRAM_SOURCE_PUBLICATION.md). Native Android projects, signing files, Telegram credentials, session databases and personal media are excluded.

The automatic GitHub source archives for this preview contain these published documents, not the complete application source. Use the `.dmg` or `.app.zip` assets to install Teragram.

## Verification and scope

See [the refinement QA record](Docs/TERAGRAM_REFINEMENTS_QA.md), [gallery-cache verification](Docs/TERAGRAM_GALLERY_CACHE_QA.md), [testing policy](TESTING.md), [privacy](PRIVACY.md) and [security](SECURITY.md). Browser journeys control Telegram/native boundaries; they are not a claim that every real account, media codec or network condition has been validated.

Existing secure-storage identifiers and purchased-license recovery compatibility are retained. No crash reports are uploaded to an upstream reporting service in the Teragram macOS profile. Required third-party notices and compatibility documents remain with the source.

---

Developed by **Kiran Dinesh (@kirxndinesh)** · [GitHub](https://github.com/kirxndinesh/Teragram)
