# Teragram architecture and verification boundaries

Reviewed on 2026-10-26. The source checkout is based on upstream commit
[`cdf799ab82473bcdfbd3e0d7195654420951d1d5`](https://github.com/caamer20/Telegram-Drive/tree/cdf799ab82473bcdfbd3e0d7195654420951d1d5)
from [caamer20/Telegram-Drive](https://github.com/caamer20/Telegram-Drive).
The public product URL is [telegram-drive.com](https://telegram-drive.com/#top).
Local Teragram changes are separate from that upstream commit.

## Evidence and scope

**Observed in source:** the files linked below define a React frontend, Tauri
command boundary, Rust Telegram client, local databases, transfer engine, and
desktop services. These observations describe implementation, not successful
execution against a live Telegram account.

**Observed on the public page:** REA capture
`ev_ee60254891ae5dd1e5546c084f831eb73f30da10f456546dc79115f4670a8912`
confirms the public landing page. It does not establish backend behavior, account
authentication, file transfer reliability, or native runtime operation.

**Inferred design approach:** the UI can be redesigned around the existing
component props, hooks, services, and native command contracts. Preserving these
boundaries reduces changes to authentication and storage behavior, but this is an
engineering assessment, not evidence that every journey remains correct.

**Not established by this review:** live Telegram sign-in, uploads/downloads,
account switching, encrypted recovery, native credential-store behavior,
installed-app updates, payments, or other platform/device acceptance. Browser
fixtures and build checks cannot establish these external behaviors. See
[TESTING.md](../TESTING.md) for the repository's E2E-only testing policy and limits.

## Source map

All paths below are relative to this repository.

| Boundary | Source | Responsibility |
| --- | --- | --- |
| Frontend entry | [app/src/App.tsx](../app/src/App.tsx), [AppProviders.tsx](../app/src/components/shared/AppProviders.tsx) | Startup health, saved session restoration, authentication routing, and ordered application providers |
| Sign-in | [AuthWizard.tsx](../app/src/components/shared/AuthWizard.tsx), [commands/auth.rs](../app/src-tauri/src/commands/auth.rs) | API credentials, phone/code and QR login, resend/cancel, Telegram cloud password, reconnect and sign-out |
| Desktop orchestration | [DesktopDashboard.tsx](../app/src/components/desktop/DesktopDashboard.tsx) | Folder/file state, query lifecycle, selection, uploads, downloads, previews, and modal actions |
| Presentation seams | [CloudSidebar.tsx](../app/src/components/desktop/cloud/CloudSidebar.tsx), [TopBar.tsx](../app/src/components/desktop/dashboard/TopBar.tsx), [CloudFileBrowser.tsx](../app/src/components/desktop/cloud/CloudFileBrowser.tsx), [TransferCenter.tsx](../app/src/components/desktop/dashboard/TransferCenter.tsx) | Navigation, search/actions, file rendering, and transfer controls |
| UI/native contract | [src-tauri/src/lib.rs](../app/src-tauri/src/lib.rs), [models.rs](../app/src-tauri/src/models.rs), [types.ts](../app/src/types.ts) | Tauri plugins, managed native state, registered commands, and serialized data |
| File operations | [useFileOperations.ts](../app/src/hooks/useFileOperations.ts), [commands/fs.rs](../app/src-tauri/src/commands/fs.rs) | Telegram channel folders, listing, upload/download, rename, delete, move, and URL uploads |
| Durable transfers | [desktopTransferEngine.ts](../app/src/services/desktopTransferEngine.ts), [transfer_engine.rs](../app/src-tauri/src/transfer_engine.rs) | Queue persistence, owner-scoped jobs, progress, pause/resume/cancel/retry, cooldown and unlock states |
| Local metadata | [db.rs](../app/src-tauri/src/db.rs), [workspace/store.rs](../app/src-tauri/src/workspace/store.rs), [workspace.ts](../app/src/services/workspace.ts) | SQLite initialization/migrations, account workspace, collections, tags, saved searches, and pagination |
| Account lifecycle | [workspace/account.rs](../app/src-tauri/src/workspace/account.rs), [currentAccount.ts](../app/src/services/currentAccount.ts), [useActionScope.ts](../app/src/hooks/useActionScope.ts) | Verified ownership, session generations, and rejection of stale actions |
| Theme | [App.css](../app/src/App.css), [ThemeContext.tsx](../app/src/context/ThemeContext.tsx), [themeEngine.ts](../app/src/theme/themeEngine.ts) | Semantic color tokens, theme persistence, and palette application |
| Desktop services | [desktop_lifecycle.rs](../app/src-tauri/src/desktop_lifecycle.rs), [server.rs](../app/src-tauri/src/server.rs), [webdav.rs](../app/src-tauri/src/webdav.rs), [sync_engine/](../app/src-tauri/src/sync_engine/) | Tray/window/background behavior, loopback media, local integrations, and folder sync |

## Authentication and transfer flow

1. On startup, `App.tsx` reads public API ID configuration, initializes the native
   client with `cmd_connect`, and checks Telegram authorization using
   `cmd_check_connection`. The dashboard does not independently reconnect on mount.
2. For a fresh session, `AuthWizard.tsx` collects credentials locally and invokes
   phone/code or QR commands. `commands/auth.rs` uses the pinned Grammers client
   over Telegram's MTProto API, including cloud-password handling where required.
   The API hash uses the OS credential store; the session is `telegram.session`
   within the Tauri application-data directory. See
   [AUTH_PASSWORD_CONTRACT.md](AUTH_PASSWORD_CONTRACT.md).
3. Saved Messages is represented by a null folder ID. Telegram channels are used
   as folders. `fileListRefresh.ts` combines cached file inventory with native
   listing chunks and accepts only matching owner, folder, and request IDs.
4. Upload/download hooks prepare actions and submit durable desktop jobs through
   `desktopTransferEngine.ts`. Rust owns transfer execution and emits progress;
   UI controls invoke queue commands rather than treating the React view as the
   transfer owner. Standard uploads transfer ordinary content directly to
   Telegram. Optional TDENC2 encryption adds native encryption/vault requirements.
5. Native file mutations call Telegram through `commands/fs.rs`; inventory/query
   invalidation updates the UI afterward. Local metadata, settings, queues, and
   caches remain on the device. There is no separate file-storage relay in the
   documented architecture.

## Isolation requirements

The current owner is read from the verified self peer in the saved Telegram
session, never inferred from an API ID or folder number. `AccountGuard` captures
the owner and lifecycle generation, validates the session file identity, and
rejects mismatched/stale operations. Workspace data lives under
`workspace/<owner>/workspace.db`; `shares.db` is initialized separately. UI query
keys, chunk checks, preview identity, transfer ownership, and pending actions must
retain their owner and folder scope. Message IDs alone are not globally unique.

Sign-out first waits for native completion, suspends account activity, cancels
work, locks the vault, and attempts remote revocation. Frontend cleanup then clears
query/image state and sign-in credentials. Preserve this ordering.

Teragram's fresh local desktop profile requires **both** the `tg-drive-local`
Cargo feature and `tauri.tg-drive.conf.json` override. They isolate credential
services and Tauri directories respectively. Upstream default identities remain
unchanged; no session, credentials, files, vault, or supporter entitlement is
migrated. Upstream updater endpoints are cleared for this profile. See
[TG_DRIVE_LOCAL_PROFILE.md](TG_DRIVE_LOCAL_PROFILE.md) for exact commands.

## Original product scope and constraints

The upstream [README](../README.md) documents Windows, macOS, Linux, Android and
Google TV; file/folder management; durable transfers; media/PDF/archive viewing;
local search, collections and offline packs; optional TDENC2 encryption; desktop
folder sync; loopback REST/WebDAV/share links; and optional lifetime ad removal.
This redesign targets the desktop UI and retains the existing native backend.
The documented object cap is 2,000,000,000 bytes; encrypted envelopes reduce the
available plaintext size. Local share links require the running desktop app and
are not hosted public links. Product documentation is not proof of acceptance on
each listed platform. Android publication restrictions remain in [AGENTS.md](../AGENTS.md).

No root source license file was present in the reviewed checkout.
[UPSTREAM-LICENSE-NOTICE](../packaging/arch/UPSTREAM-LICENSE-NOTICE) explicitly
records the absence and does not grant additional rights. Reuse/distribution
rights remain unresolved; a UI rename does not resolve them. Preserve upstream
authorship and avoid publication until licensing is clarified. Supporter
compatibility is separately protected by
[SUPPORTER_LICENSE_INVARIANTS.md](../SUPPORTER_LICENSE_INVARIANTS.md).

## Manual live Telegram acceptance

The user should complete these checks in the isolated native Teragram profile,
using their own account and a disposable file they own. Enter API credentials,
login codes and passwords only in the app; never place them in chat, screenshots,
logs, or reports.

- [ ] Open Teragram with both isolation options and confirm it starts with a fresh
      profile, without adopting the installed Teragram session.
- [ ] Enter a personal API ID/hash from Telegram's API development tools; complete
      QR or phone/code sign-in and cloud-password verification if required.
- [ ] Open Saved Messages and confirm the correct account's files appear.
- [ ] Upload a small, uniquely named disposable test file. Confirm completion and
      confirm the file exists in the same account's Telegram Saved Messages.
- [ ] Download that test file to a separate local destination. Compare its bytes
      or SHA-256 hash against the original; check filename and completion state.
- [ ] Restart Teragram and confirm its own session restores and the test file is
      listed. Confirm the original installed app's profile remains unaffected.
- [ ] Delete only that disposable uploaded test file from Teragram. Confirm its
      removal in both Teragram and Telegram. Do not delete unrelated files.

Record pass/fail and sanitized errors for these checks. Completion establishes
only this basic account/file journey; encrypted recovery, interrupted/resumed
large transfers, multiple accounts, native notifications, and other platforms
still require their own acceptance.

## Dashboard overhaul

See [TG_DRIVE_UI_AUDIT.md](TG_DRIVE_UI_AUDIT.md) for the source audit, native ad
removal, Settings additions, Photos aggregation and exact verification boundaries.
