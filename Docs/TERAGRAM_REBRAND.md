# Teragram identity and profile compatibility

Teragram v1.0 uses `com.teragram.app`. Before Tauri plugins or WebKit start on macOS, it atomically renames existing `local.tgdrive.desktop` directories in Application Support, Caches, and WebKit to the new identifier, then creates compatibility aliases at the old paths. Existing Teragram profiles are never overwritten. No SQLite files are copied or merged. Existing absolute cache paths remain valid. Quit the previous app before starting Teragram.

The new directories are authoritative; old paths resolve through compatibility aliases. Rollback retains the same account state. Do not delete those directories; relocation requires an offline migration and backup.

Secure credential service names, entitlement keys, Telegram folder markers, native commands, compatibility launchers, and storage keys retain their established identifiers. These compatibility interfaces do not display old branding. No credentials or signing keys are rotated.

The Main Icon artboard is cropped to `70 70 360 360`, retaining its glow. The White Favicon supplies the macOS template tray at 22/44 pixels. The browser favicon uses the Black Favicon with a white silhouette in dark mode. Windows/Android icons are generated locally; platform conversion and publication remain paused.
