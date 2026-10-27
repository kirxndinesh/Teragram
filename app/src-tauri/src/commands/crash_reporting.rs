//! Local-only crash diagnostics. There is no upload client or configurable endpoint.
use serde::Deserialize;
use tauri::Manager;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CrashReportInput {
    event: String,
    app_version: String,
    source: String,
    error_type: String,
    frames: Vec<String>,
    platform: String,
    occurred_at: String,
}

pub(crate) fn record_local_crash(report: CrashReportInput) -> Result<(), String> {
    let safe = |value: &str, max: usize| {
        value.len() <= max
            && value
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || b"._<>-+:TZ ".contains(&c))
    };
    if report.event != "app_crash"
        || !safe(&report.app_version, 32)
        || !["react", "window", "promise"].contains(&report.source.as_str())
        || !safe(&report.error_type, 96)
        || !safe(&report.platform, 96)
        || !safe(&report.occurred_at, 64)
        || report.frames.len() > 6
        || report.frames.iter().any(|frame| !safe(frame, 160))
    {
        return Err("Local crash record did not match the privacy-safe schema".into());
    }
    // The rotating application logger redacts each line and caps disk usage.
    // Do not add error messages, source paths, Telegram data or identifiers.
    log::error!(
        "Local crash: source={} type={} version={} frames={:?}",
        report.source,
        report.error_type,
        report.app_version,
        report.frames
    );
    Ok(())
}

#[tauri::command]
pub fn cmd_record_local_crash(report: CrashReportInput) -> Result<(), String> {
    record_local_crash(report)
}

#[tauri::command]
pub fn cmd_open_local_crash_logs(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let directory = app
        .path()
        .app_log_dir()
        .map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    app.opener()
        .open_path(directory.to_string_lossy(), None::<&str>)
        .map_err(|error| error.to_string())
}
