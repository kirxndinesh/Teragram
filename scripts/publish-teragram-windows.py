"""Publish the exact Windows candidate whose build/install gates already passed.

The fixed run, source commit and archive digest are deliberate: a branch update
or another artifact with the same name must never change the binary published.
"""

import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import zipfile

REPO = "kirxndinesh/Teragram"
RUN = 40546764034
COMMIT = "93fd5cff1c2860cf3e5891bd64415d30e6ce35e7"
ARTIFACT = 12754934942
ARCHIVE_SHA256 = "523eaa2c0b0410818d2c703a9644154b2d202209d6affe480bc950e6ff0cb04f"
TAG = "v1.0.0-windows-preview"
INSTALLER = "Teragram_1.0.0_windows_x64_setup.exe"
FILES = {INSTALLER, "SHA256SUMS-windows.txt", "windows-build-report.json"}
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "release-assets" / "windows-publication"


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def gh(*args):
    result = subprocess.run(["gh", *args], text=True, capture_output=True)
    if result.returncode:
        message = re.sub(r"(https://[^\s?]+)\?[^\s]+", r"\1?[redacted]", result.stderr)
        operation = " ".join(args)
        raise RuntimeError(f"GitHub {operation}: {message.strip() or 'command failed'}")
    return result.stdout


def api(endpoint, payload=None):
    args = ["api", f"repos/{REPO}/{endpoint}"]
    if payload is not None:
        request = OUT / "request.json"
        request.write_text(json.dumps(payload), encoding="utf-8")
        args += ["--method", "POST", "--input", str(request)]
    return json.loads(gh(*args))


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify_files():
    report = json.loads((OUT / "windows-build-report.json").read_text(encoding="utf-8-sig"))
    for key, expected in {
        "product": "Teragram", "version": "1.0.0", "architecture": "x64",
        "commit": COMMIT, "installer": INSTALLER,
        "nativeInstallerSmoke": "passed", "browserAndNativeJourneys": "passed",
    }.items():
        require(report.get(key) == expected, f"Unexpected build-report field: {key}")
    require(str(report.get("run")) == str(RUN), "Build report is from another run")
    require(report.get("signature") in ("NotSigned", "Valid"), "Invalid installer signature status")
    actual = digest(OUT / INSTALLER)
    require(report.get("sha256") == actual, "Installer and build-report SHA256 disagree")
    checksums = (OUT / "SHA256SUMS-windows.txt").read_text(encoding="utf-8-sig").split()
    require(checksums == [actual, INSTALLER], "Installer checksum file disagrees")
    require((OUT / INSTALLER).read_bytes()[:2] == b"MZ", "Installer is not a Windows executable")


def prepare():
    run = api(f"actions/runs/{RUN}")
    require(run["status"] == "completed" and run["conclusion"] == "success", "Windows run did not pass")
    require(run["head_sha"] == COMMIT, "Windows run source changed")
    require(run["path"] == ".github/workflows/teragram-windows.yml", "Unexpected verification workflow")
    jobs = api(f"actions/runs/{RUN}/jobs")["jobs"]
    require(len(jobs) == 1 and jobs[0]["conclusion"] == "success", "Windows job did not pass")
    steps = {step["name"]: step["conclusion"] for step in jobs[0]["steps"]}
    for name in (
        "Exercise the complete desktop browser journeys on Windows",
        "Exercise native process, storage and HTTP journeys on Windows",
        "Repeat native media and memory regressions",
        "Lint Windows native targets",
        "Download and verify the Microsoft runtime",
        "Build the Teragram Windows installer",
        "Inspect the installer and Windows runtime dependencies",
        "Install and launch the packaged app in the disposable Windows runner",
        "Prepare checked release candidate",
    ):
        require(steps.get(name) == "success", f"Windows gate did not pass: {name}")
    artifact = api(f"actions/artifacts/{ARTIFACT}")
    require(artifact["name"] == "teragram-windows-x64-candidate" and not artifact["expired"], "Candidate unavailable")
    require(artifact["workflow_run"]["id"] == RUN and artifact["workflow_run"]["head_sha"] == COMMIT, "Wrong artifact provenance")
    require(artifact["digest"] == f"sha256:{ARCHIVE_SHA256}", "Artifact archive digest changed")
    archive = OUT / "candidate.zip"
    with archive.open("wb") as output:
        subprocess.run(["gh", "api", f"repos/{REPO}/actions/artifacts/{ARTIFACT}/zip"], stdout=output, check=True)
    require(digest(archive) == ARCHIVE_SHA256, "Downloaded archive checksum mismatch")
    with zipfile.ZipFile(archive) as zipped:
        require(len(zipped.infolist()) == len(FILES) and set(zipped.namelist()) == FILES, "Unexpected artifact contents")
        for name in FILES:
            (OUT / name).write_bytes(zipped.read(name))
    verify_files()
    print("Verified successful Windows gates, pinned archive and installer SHA256.")


def verify_assets(release):
    assets = release["assets"]
    require({asset["name"] for asset in assets} == FILES and len(assets) == len(FILES), "Unexpected release assets")
    for asset in assets:
        local = OUT / asset["name"]
        require(asset["state"] == "uploaded" and asset["size"] == local.stat().st_size, "Release upload incomplete")
        require(asset.get("digest") == f"sha256:{digest(local)}", "Uploaded release asset checksum mismatch")


def verify_existing_tag():
    refs = subprocess.check_output(
        ["git", "ls-remote", "origin", f"refs/tags/{TAG}", f"refs/tags/{TAG}^{{}}"],
        text=True,
    ).splitlines()
    hashes = {line.split()[1]: line.split()[0] for line in refs}
    target = hashes.get(f"refs/tags/{TAG}^{{}}", hashes.get(f"refs/tags/{TAG}"))
    require(target == COMMIT, "Publish the verified source tag through Git before creating its release")


def publish():
    verify_files()
    verify_existing_tag()
    pages = json.loads(gh("api", "--paginate", "--slurp", f"repos/{REPO}/releases"))
    matches = [release for page in pages for release in page if release["tag_name"] == TAG]
    require(len(matches) <= 1, "Duplicate release tags")
    if matches:
        release = matches[0]
        require(release["prerelease"], "Refusing to modify a stable release")
        if not release["draft"]:
            verify_assets(release)
            print(release["html_url"])
            return
    else:
        notes = f"""## Teragram 1.0.0 — Windows x64 Preview

Download **{INSTALLER}** below and run it on Windows 10/11 x64. The installer includes the verified Microsoft Visual C++ prerequisite and WebView2 bootstrapper.

This local-first desktop profile keeps metadata, settings, cache and credentials on your PC. Telegram login and remote file transfers require Internet access. Enter your own Telegram API credentials and sign in locally. No sponsor/checkout frontend or supporter Worker is required to start this profile.

### Verification
- 127 browser E2E journeys and 213 native Windows journeys passed.
- Media/account-revocation and HEIC-memory regressions each passed five repetitions.
- Windows native lint, runtime and installer inspection, and a fresh install-and-launch readiness check passed.
- Exact application source: `{COMMIT}`. [Windows verification run](https://github.com/{REPO}/actions/runs/{RUN}).

The installer is unsigned; Windows may display SmartScreen warnings. This is a preview: real Telegram account/2FA and transfer acceptance on a Windows PC remain separate from controlled fixtures and startup verification. Automatic updates are disabled for this local profile.

`SHA256SUMS-windows.txt` and `windows-build-report.json` accompany the exact verified installer. The existing macOS release is unchanged.
"""
        release = api("releases", {
            "tag_name": TAG,
            "name": "Teragram v1.0 — Windows x64 Preview", "body": notes,
            "draft": True, "prerelease": True, "make_latest": "false",
        })
    # The existing tag is authoritative. Avoid requesting creation of a tag at
    # a historical workflow commit with the Actions token's narrower scope.
    verify_existing_tag()
    existing = {asset["name"]: asset for asset in release["assets"]}
    require(set(existing) <= FILES, "Draft contains unexpected assets")
    missing = []
    for name in sorted(FILES):
        if name in existing:
            require(existing[name].get("digest") == f"sha256:{digest(OUT / name)}", "Existing draft asset differs")
        else:
            missing.append(str(OUT / name))
    if missing:
        gh("release", "upload", TAG, *missing, "--repo", REPO)
    release = api(f"releases/{release['id']}")
    verify_assets(release)
    request = OUT / "publish.json"
    request.write_text(json.dumps({"draft": False, "prerelease": True, "make_latest": "false"}), encoding="utf-8")
    release = json.loads(gh("api", "--method", "PATCH", f"repos/{REPO}/releases/{release['id']}", "--input", str(request)))
    require(not release["draft"] and release["prerelease"], "Preview publication did not complete")
    tag = api(f"git/ref/tags/{TAG}")["object"]
    require(tag["type"] == "commit" and tag["sha"] == COMMIT, "Published tag does not match the tested source")
    verify_assets(release)
    print(release["html_url"])
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as summary:
            summary.write(f"Published [{TAG}]({release['html_url']}) with all three asset checksums verified.\n")


if __name__ == "__main__":
    try:
        require(os.environ.get("GITHUB_ACTIONS") == "true", "Run publication in GitHub Actions")
        require(len(sys.argv) == 2 and sys.argv[1] in ("prepare", "publish"), "Expected prepare or publish")
        OUT.mkdir(parents=True, exist_ok=True)
        {"prepare": prepare, "publish": publish}[sys.argv[1]]()
    except Exception as error:
        message = str(error).replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
        print(f"::error::{message}", flush=True)
        raise
