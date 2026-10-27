//! macOS flattened design previews through the OS decoder, with bounded work.
use std::path::Path;
pub(crate) fn is_name(name: &str) -> bool {
    Path::new(name)
        .extension()
        .and_then(|v| v.to_str())
        .is_some_and(|v| {
            ["psd", "psb", "ai"]
                .iter()
                .any(|ext| v.eq_ignore_ascii_case(ext))
        })
}
#[cfg(target_os = "macos")]
pub(crate) fn decode(
    input: &Path,
    destination: &Path,
    maximum: (u32, u32),
    format: &str,
    check: impl Fn() -> Result<(), String>,
) -> Result<crate::heic::DecodeReport, String> {
    use std::{
        io::BufWriter,
        path::PathBuf,
        process::Command,
        time::{Duration, Instant},
    };
    struct Scratch(PathBuf);
    impl Drop for Scratch {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }
    check()?;
    let metadata = std::fs::symlink_metadata(input).map_err(|e| e.to_string())?;
    if !metadata.file_type().is_file()
        || metadata.len() == 0
        || metadata.len() > crate::heic::SOURCE_LIMIT
    {
        return Err("DESIGN_PREVIEW_UNAVAILABLE: source exceeds 64 MB".into());
    }
    let directory = destination
        .parent()
        .ok_or("Missing preview directory")?
        .join(format!(".design-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&directory).map_err(|e| e.to_string())?;
    let scratch = Scratch(directory);
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&scratch.0, std::fs::Permissions::from_mode(0o700))
            .map_err(|e| e.to_string())?;
    }
    let pdf_compatible = if format == "ai" {
        use std::io::Read;
        let mut header = [0u8; 1024];
        let length = std::fs::File::open(input)
            .map_err(|e| e.to_string())?
            .read(&mut header)
            .map_err(|e| e.to_string())?;
        header[..length].windows(5).any(|bytes| bytes == b"%PDF-")
    } else {
        false
    };
    let extension = match format {
        "ai" if pdf_compatible => "pdf",
        "ai" => "ai",
        "psb" => "psb",
        _ => "psd",
    };
    let staged = scratch.0.join(format!("source.{extension}"));
    std::fs::copy(input, &staged).map_err(|e| e.to_string())?;
    let output = staged.with_extension(format!("{extension}.png"));
    let mut command = Command::new("/usr/bin/qlmanage");
    command
        .args(["-t", "-s"])
        .arg(maximum.0.max(maximum.1).min(2400).to_string())
        .arg("-o")
        .arg(&scratch.0)
        .arg(&staged);
    let outcome = crate::process_budget::run(
        command,
        Instant::now() + Duration::from_secs(30),
        false,
        &check,
        Some((&output, crate::heic::OUTPUT_LIMIT)),
    )?;
    check()?;
    if !outcome.success {
        return Err("DESIGN_PREVIEW_UNAVAILABLE: macOS could not decode this document".into());
    }
    let metadata = std::fs::symlink_metadata(&output).map_err(|_| "DESIGN_PREVIEW_UNAVAILABLE")?;
    if !metadata.file_type().is_file() || metadata.len() > crate::heic::OUTPUT_LIMIT {
        return Err("DESIGN_PREVIEW_UNAVAILABLE".into());
    }
    let mut reader = image::ImageReader::open(&output)
        .map_err(|e| e.to_string())?
        .with_guessed_format()
        .map_err(|e| e.to_string())?;
    let mut limits = image::Limits::default();
    limits.max_image_width = Some(4096);
    limits.max_image_height = Some(4096);
    limits.max_alloc = Some(128 * 1024 * 1024);
    reader.limits(limits);
    let image = reader
        .decode()
        .map_err(|e| e.to_string())?
        .thumbnail(maximum.0, maximum.1)
        .to_rgb8();
    let temporary = scratch.0.join("preview.jpg");
    let writer = BufWriter::new(std::fs::File::create(&temporary).map_err(|e| e.to_string())?);
    image::codecs::jpeg::JpegEncoder::new_with_quality(writer, 92)
        .encode_image(&image)
        .map_err(|e| e.to_string())?;
    check()?;
    if std::fs::metadata(&temporary)
        .map_err(|e| e.to_string())?
        .len()
        > crate::heic::OUTPUT_LIMIT
    {
        return Err("DESIGN_PREVIEW_UNAVAILABLE".into());
    }
    std::fs::rename(temporary, destination).map_err(|e| e.to_string())?;
    Ok(crate::heic::DecodeReport {
        decoder: "macOS Quick Look".into(),
        metrics: outcome.metrics,
    })
}
