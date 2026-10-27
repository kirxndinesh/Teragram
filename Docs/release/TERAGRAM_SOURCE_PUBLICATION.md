# Teragram macOS source publication review

The new repository will contain a clean source snapshot, without the old repository history. Native Android projects, generated assets, signing files, Android packaging scripts and Android screenshots remain local.

The following eight shared compatibility/build files are required by the current desktop source or its verification scripts. The existing publication policy requires the repository owner to explicitly approve these paths as shared files before publication:

- `app/src-tauri/src/android_security.rs` — desktop no-op command implementations alongside guarded mobile implementations.
- `app/src-tauri/src/jni_cache.rs` — module referenced by the shared native application.
- `app/src/components/mobile/ActionPopover.tsx` — shared frontend dependency graph.
- `app/src/components/mobile/BottomNavBar.tsx` — shared frontend/accessibility fixture dependency graph.
- `app/src/components/mobile/RenameFolderSheet.tsx` — shared frontend dependency graph.
- `app/src/services/androidReauthentication.ts` — imported by shared encryption settings; no-op on desktop.
- `app/src/services/androidTransferPolicy.ts` — imported by the shared download hook.
- `scripts/generate-gradle-sbom.cjs` — referenced by the existing dependency-assurance E2E journey.

No SDK project, manifest, Gradle build configuration, Kotlin/Java source, keystore, credential, session database or personal media is proposed for publication. This approval does not authorize Windows/Android builds or releases.

Status: the owner chose the macOS binary release first (2026-10-27). Approval of the eight shared compatibility files and the full source import is deferred. Windows/Android builds remain postponed.
