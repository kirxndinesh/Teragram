//! Preserve existing macOS profiles before Tauri plugins or WebKit initialize.
#[cfg(target_os = "macos")]
pub(crate) fn prepare_home(home: &std::path::Path) -> Result<(), String> {
    for directory in ["Application Support", "Caches", "WebKit"] {
        let base = home.join("Library").join(directory);
        let old = base.join("local.tgdrive.desktop");
        let new = base.join("com.teragram.app");
        if !old.is_dir() {
            continue;
        }
        // Never overwrite profiles, merge databases, or copy live SQLite WALs.
        match std::fs::symlink_metadata(&new) {
            Ok(_) => continue,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(format!("Cannot inspect Teragram profile: {error}")),
        }
        // The new managed root must be a real directory: cache guards reject
        // symlinks at managed roots. Rename atomically, then preserve old paths.
        std::fs::rename(&old, &new)
            .map_err(|error| format!("Cannot migrate the existing {directory} profile: {error}"))?;
        if let Err(error) = std::os::unix::fs::symlink(&new, &old) {
            let rollback = std::fs::rename(&new, &old);
            return Err(format!(
                "Cannot preserve legacy profile paths: {error}; rollback: {rollback:?}"
            ));
        }
    }
    Ok(())
}
pub(crate) fn prepare(identifier: &str) -> Result<(), String> {
    if identifier != "com.teragram.app" {
        return Ok(());
    }
    #[cfg(target_os = "macos")]
    {
        #[allow(deprecated)]
        let home = std::env::home_dir().ok_or("The macOS home directory is unavailable")?;
        prepare_home(&home)?;
    }
    Ok(())
}
