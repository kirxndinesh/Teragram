# Teragram local desktop profile

Teragram uses a fresh local desktop profile for development alongside an installed
Teragram application. Always use the Cargo feature and Tauri override
together. The convenient launchers supply both and automatically use the workspace-local Rust toolchain when present. From `app/`:

```sh
npm run tg:dev
npm run tg:build
```

Equivalent explicit development command:

```sh
npm run tauri -- dev --features tg-drive-local --config src-tauri/tauri.tg-drive.conf.json
```

To build the same isolated profile without launching it:

```sh
npm run tauri -- build --debug --features tg-drive-local --config src-tauri/tauri.tg-drive.conf.json
```

The override selects the product name **Teragram** and bundle identifier
`local.tgdrive.desktop`. Tauri resolves separate application data, configuration,
and cache directories for this identity. The `tg-drive-local` Cargo feature selects
separate operating-system credential services:

| Credential | Teragram local service |
| --- | --- |
| Telegram API hash | `local.tgdrive.desktop.telegram-api` |
| Proxy password | `local.tgdrive.desktop.proxy` |
| Supporter IPC | Excluded from the Teragram build |

Credential account names and credential handling remain unchanged. No existing
Telegram session, API hash, proxy password, vault, files, or supporter activation
is copied or migrated. Sign in to Telegram afresh using credentials entered in
this profile. Existing Teragram supporter activations remain in their
original profile; this local development build does not migrate entitlements or
change payment verification, token compatibility, or supporter rights.

The configuration clears upstream updater endpoints and disables updater artifact
generation. This local build cannot update itself from Teragram releases.
Do not provide production supporter service build variables or perform real
checkout during local development.

Both options are required: the Tauri identifier isolates files, while the Cargo
feature isolates operating-system credentials. Using only one does not isolate
the entire profile. These options are desktop-only; they do not define an Android
profile or authorize Android source publication.

Default builds retain the upstream bundle identity, updater configuration and
credential services. The redesigned frontend and removed native advertising apply
to this local source tree. Reverting this local
profile means building without both options; it does not modify or delete either
profile's data. Do not distribute this source or binaries until the upstream
licensing terms have been resolved.

Teragram has no sponsor gateway, ad server, donation prompt or supporter IPC.
The legacy payment service source is retained only for historical compatibility.
