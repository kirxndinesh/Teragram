# Teragram v1.0 — macOS implementation and QA

Latest refinement results are recorded in [TERAGRAM_REFINEMENTS_QA.md](TERAGRAM_REFINEMENTS_QA.md). The measurements below document the initial branding pass.

Verified 27 October 2026. The local macOS application is built and opened at:
`app/src-tauri/target/release/bundle/macos/Teragram.app`.
The bundle reports Teragram, version 1.0.0, identifier `com.teragram.app`.

## Completed changes

- Product strings, window title, owned package metadata and About use Teragram. About displays v1.0 and opens the supplied official repository through the native external opener.
- Supplied Main Icon is cropped around the artwork and integrated into the header, onboarding/About and generated native icon suite. Monochrome favicons supply the separate template tray and adaptive browser favicon. Windows/Android icon generation does not constitute a platform build.
- Settings is accessed through Profile or Cmd/Ctrl+, with standalone header/sidebar buttons removed. Standard native application menus remain available.
- Gallery columns depend on window breakpoints and zoom, not workspace width. Sidebar animation preserves card nodes and column membership. A batched FLIP pass handles actual zoom/data reordering; no gallery ResizeObserver runs during sidebar animation.
- Shared easing tokens cover route entry, thumbnails, hover, tree height/chevrons, menus and press feedback. Hidden tree children remain inert and excluded from accessible navigation. Reduced-motion preferences disable these CSS animations and reduce Framer Motion transitions.
- Previous v1 work remains integrated: selectable Folders overview, clean individual folders, reactive sorting/type order, centered 44px rail controls, allocation icon, local Favorites, bounded seek-prefetch, subtitle/audio/speed/sync/fit controls, progressive originals and document previews.
- macOS profile migration atomically relocates previous data/cache/WebKit directories and retains compatibility aliases at the previous paths. The actual existing Telegram account, avatar, folders, indexed files and appearance preferences were visible after launching Teragram. Credential service identifiers are unchanged.

## Verification evidence

| Check | Result | Boundary |
|---|---|---|
| Full desktop browser suite | 81 passed | Actual React app; controlled native/Telegram boundary |
| Full native suite | 220 passed | Native child processes, SQLite, local HTTP, streaming ranges, cancellation, encryption, transfers and account isolation |
| Legacy cache compatibility subset | 11 passed | Includes high-DPI offline thumbnails, external-file proofs and symlink refusal |
| Supporter service type check | Passed | Local TypeScript |
| Supporter service E2E | 27 passed | Local workerd/D1; simulated payment transport |
| Worker package | Dry-run passed | No deployment or production mutation |
| Frontend production build / TypeScript | Passed | Vite production assets |
| Localization / literal budget | Passed | All canonical catalogs |
| Native formatting / reviewed line lengths | Passed | cargo fmt and repository formatting gate |
| App security / test policy / workflow protections | Passed | Static configuration and source gates |
| Bundle budgets | Passed | Initial JS 495295; desktop route 317977; CSS 197543; locale total 2001166 bytes |
| Packaged macOS launch | Passed | Real account session and existing workspace preserved |
| Native rail shortcut | Passed | Accessibility state changed to Expand sidebar after Cmd+B |

The browser motion journey samples 25 animation frames and asserts unchanged column count and card-node identity through sidebar collapse. It does not certify a fixed frame rate on every display or hardware configuration. Accessibility audits run on settled light/dark views, not intermediate fade opacity.

## Practical limits and release state

- Real network transfer completion for every personal file was not asserted. Cloud-provider placeholders must first be downloaded locally; unavailable sources now fail with an actionable local-source message rather than misleading network retries.
- Native browser codecs determine embedded track support. Real MP4 playback, dual-audio fragmented MP4 selection and imported SRT/VTT/ASS tracks are exercised. Arbitrary MKV codecs/embedded tracks and every movie/audio synchronization combination are not certified.
- FFmpeg is unavailable on this Mac's normal application PATH. Files without a Telegram thumbnail can display a media placeholder. Conversion and unsupported-codec fallback require a supported FFmpeg installation. The old private FFmpeg test fixture is not bundled or suitable for publication.
- PDF/text, creative-preview, range streaming and transfer checks include controlled fixture coverage; this is not a claim that every external document or damaged media file decodes.
- This is a locally built application. Developer ID signing, notarization, update distribution, Windows/Android builds and public release acceptance are not completed here.
- Release publication is paused; the workflow retains signing and deployment protections. No Git push or remote release occurred. The Android publication check reports 27 existing paths awaiting the repository owner's review; they are not self-approved.

See [profile compatibility](TERAGRAM_REBRAND.md). Prior data directories must not be deleted while compatibility aliases are in use.
