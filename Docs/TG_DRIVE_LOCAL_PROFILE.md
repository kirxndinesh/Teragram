# Teragram local desktop profile

Teragram provides a local desktop profile for development and Windows packaging.
Always use the Cargo feature and Tauri override
together. The convenient launchers supply both and automatically use the workspace-local Rust toolchain when present. From `app/`:

```sh
npm run tg:dev
npm run tg:build
```

Equivalent explicit development command:

```sh
npm run tauri -- dev --features tg-drive-local --config src-tauri/tauri.tg-drive.conf.json
```

To build the same profile without launching it:

```sh
npm run tauri -- build --debug --features tg-drive-local --config src-tauri/tauri.tg-drive.conf.json
```

The override selects the product name **Teragram** and bundle identifier
`com.teragram.app`. Tauri resolves application data, configuration,
and cache directories for this identity. On macOS the existing local development
profile is migrated without overwriting a destination profile. On Windows a fresh
installation keeps metadata and cache on this PC. The `tg-drive-local` Cargo feature selects
separate operating-system credential services:

| Credential | Teragram local service |
| --- | --- |
| Telegram API hash | `local.tgdrive.desktop.telegram-api` |
| Proxy password | `local.tgdrive.desktop.proxy` |
| Supporter IPC | Excluded from the Teragram build |

Credential account names and credential handling remain unchanged. A fresh Windows
installation does not import a Mac session, API hash, proxy password, vault or
personal files. Sign in locally using credentials entered on that PC.
Existing Teragram supporter activations remain in their
original profile; this local development build does not migrate entitlements or
change payment verification, token compatibility, or supporter rights.

The configuration clears upstream updater endpoints and disables updater artifact
generation. This local build cannot update itself from Teragram releases.
Do not provide production supporter service build variables or perform real
checkout during local development.

Both options are required for the intended product configuration and credential
services. Development and installed Teragram builds using `com.teragram.app` share
the same per-user data root; use a disposable Windows account for installer smoke
tests. These options are desktop-only; they do not define an Android
profile or authorize Android source publication.

Default builds retain their configured bundle identity, updater configuration and
credential services. The redesigned frontend and removed native advertising apply
to this local source tree. Reverting this local
profile means building without both options; it does not modify or delete either
profile's data. Do not distribute this source or binaries until the upstream
licensing terms have been resolved.

Teragram has no sponsor gateway, ad server, donation prompt or supporter IPC in
this local profile. Telegram storage and login still require Internet access;
local-first does not mean a standalone offline replacement for Telegram.
The legacy payment service and native entitlement verification remain covered by
their separate HTTP/native compatibility suites.

`npm test`, `npm run test:e2e` and `npm run teragram:test` exercise the same current
desktop journeys. `npm run visual:test` exercises the current gallery snapshots,
accessibility and desktop dialog/storage fixtures. Historical sponsor placement
and purchase-screen fixtures remain in the source but do not describe this UI
and are not selected by these local-profile entrypoints.
