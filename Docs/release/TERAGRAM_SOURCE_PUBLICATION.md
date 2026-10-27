# Teragram desktop source publication review

The repository contains a clean source snapshot, without the old repository history. Native Android projects, generated assets, signing files, Android packaging scripts and Android screenshots remain local.

The following eight shared compatibility/build files are required by the current desktop source or its verification scripts. The owner approved their inclusion by requesting the source necessary for Windows development after the eight-file review:

- `app/src-tauri/src/android_security.rs` — desktop no-op command implementations alongside guarded mobile implementations.
- `app/src-tauri/src/jni_cache.rs` — module referenced by the shared native application.
- `app/src/components/mobile/ActionPopover.tsx` — shared frontend dependency graph.
- `app/src/components/mobile/BottomNavBar.tsx` — shared frontend/accessibility fixture dependency graph.
- `app/src/components/mobile/RenameFolderSheet.tsx` — shared frontend dependency graph.
- `app/src/services/androidReauthentication.ts` — imported by shared encryption settings; no-op on desktop.
- `app/src/services/androidTransferPolicy.ts` — imported by the shared download hook.
- `scripts/generate-gradle-sbom.cjs` — referenced by the existing dependency-assurance E2E journey.

No SDK project, manifest, Gradle build configuration, Kotlin/Java source, keystore, credential, session database or personal media is proposed for publication. The owner authorized the Windows development source handoff. Android builds/releases remain deferred; Windows binary verification is to continue on the owner's Windows PC.

Status: approved for the Windows source handoff on 2026-10-27. The eight paths are now classified as permitted shared files in `dependency-policy/android-publication-review.json`. Other Android-specific paths remain unapproved and excluded from the published snapshot.
