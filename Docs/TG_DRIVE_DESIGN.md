# Teragram design and validation

## Visual system

- Seamless two-column shell: 248px navigation (218px at compact desktop widths)
  and a flexible full-width workspace, with borderless pill search and 40px icons.
- Dark canvas `#191919`, sidebar `#202020`, elevated surfaces `#252525`, hover
  `#2C2C2C`, input `#2A2A2A`, text `#EDEDED` and metadata `#9B9B9B`.
- White light canvas, `#F8F9FA` navigation and `#F1F3F4` search, using the same
  spacing, geometry and hierarchy as Dark.
- System/Light/Dark modes and eight curated/custom accents persist locally.
  Accent text and button foregrounds derive contrast-safe tones; fill, tint and
  hover colors update throughout the shell. Invalid hex input never replaces
  the last valid color. Legacy custom theme records remain stored but inactive.
- Local Inter variable font and OFL license; no third-party runtime font request.
- Sidebar storage shows real indexed bytes, without inventing a Telegram quota.
  Its floating category breakdown retains inventory coverage and refresh.
- My Cloud retains virtualized table rows. Photos uses responsive masonry stacks
  with natural image ratios, progressive mounting and viewport-driven thumbnails.
  Unknown/undecodable previews get media placeholders, with reduced-motion-aware
  loading shimmer. Duration badges use native metadata; unavailable durations
  are not fabricated.
- Upload/create actions live in the header plus menu; connection/sync/logout live
  in the profile menu. Existing native folder sync and transfer wiring is retained.
- Images and media share a floating translucent glass viewer. Explicit fullscreen
  expands it only when requested, including via F. Outside-click/Escape dismiss
  the floating view, and closing waits for its 180ms exit animation. A single auto-hiding HUD
  contains navigation, file actions and media controls. Native duplicate toolbars,
  history buttons and shortcut badges are removed from the presentation.
- Seek, speed, mute/volume, PiP and fullscreen target the actual active media
  element. Fragmented MP4 duration falls back to known track/buffered duration.
  Mouse-based scrubbing does not pin the HUD open after the seek slider retains focus.
  Streaming, fallback/transcode choices and diagnostics remain available in Info.
- Keyboard focus and open menus keep the HUD available. Modal focus trapping,
  Escape, arrow navigation, image zoom and source-safe multi-selection remain.

## Verification

All 49 Teragram browser E2E journeys pass and exercise the real app entry point with a simulated native
and Telegram boundary. Coverage includes account/vault invalidation, duplicate
message IDs, selection and preview separation, settings/allocation persistence,
transfer protection, search, sync settings, both themes, custom accents and
System-mode changes. Dashboard and Photos axe audits pass in both modes, with
1000/1440px layout checks. A custom Rose accent is also audited in navigation.

A separate real-MP4 journey decodes a generated H.264 fixture through HTTP Range
responses, changes speed, seeks, preserves volume through mute/unmute and checks
2.5-second HUD hiding and pointer restoration. This is browser media evidence,
not a claim of live Telegram or native WebKit codec acceptance. Missing and black
thumbnail journeys verify visible fallback cards and actual metadata badges.

TypeScript, production compilation, bundle budgets, locale/literal validation,
E2E policy and application security configuration remain enforced. Five existing
locale copied-English warnings remain within baseline. Native builds use the
isolated `tg-drive-local` identity and credential namespace. The rebuilt native app was inspected connected to the existing Telegram session;
its media viewer was observed playing with the new single HUD. Live transfer
round trips and encryption recovery remain separate acceptance steps.

## Performance review

The polish removes preset/editor code and duplicate player UI. Measured initial
JavaScript is about 495KB, total JavaScript 2.39MB, desktop route 305KB,
Settings 116KB and media 227KB, each within unchanged JavaScript budgets.
CSS measures 172,419 bytes (reviewed ceiling 174,000) for the shell, HUD, popover,
accent picker and placeholder states. The translated labels across 24 catalogs bring locale
bytes to 1,983,243 and the largest catalog to 140,855 (ceilings 1,984,000/141,000).
No dependency or external asset request was added. Table virtualization,
progressive gallery mounting and lazy media modules remain. Exact measurements
are emitted by `npm run bundle:check` to `app/dist/bundle-report.json`.
The 876,576-byte Inter TTF remains local and separate from JS/CSS totals.

Screenshots under `../tg-drive-evidence/` use synthetic files, not the user's
Telegram photos. The earlier public-page REA capture remains separate. See
[TG_DRIVE_UI_AUDIT.md](TG_DRIVE_UI_AUDIT.md) for the backend boundary/removal map.
Two previously passing native child-process/HTTP journeys verify removed ad routes
and media-server port fallback; the full native suite was not run for this polish.

## Floating preview and metadata fixes

General now starts with Appearance & Startup; the Themes tab exclusively owns
mode/accent controls. Settings controls share a 220px rail (190px in compact
layouts), 36px controls and scroll/footer breathing room. The main search is
bounded to 560px and the action group uses the far right of the full-width header.

The viewer fades in over 220ms, scales in over 260ms, transitions incoming media
over 180ms and fades/scales out before dismissal. Reduced motion disables these
animations. Images begin with the account-scoped cached thumbnail and request the
original immediately; the original is decoded before its 200ms reveal. Small
source thumbnails are never enlarged by CSS or the native raster renderer.

Native thumbnail selection ranks real Telegram photo sizes by pixel area rather
than closeness to 60KB and excludes stripped/path miniatures. Renditions fit within
1600×1600, use Lanczos downscaling and JPEG quality 88, and retain the 1MB output,
16MB source and three-decoder limits. Thumbnail keys use a new version; original
cache identifiers remain unchanged. HEIC conversion keeps its existing bounded
helper pipeline with the larger thumbnail target.

`filePresentation.ts` normalizes current and legacy timestamps and derives names
from file/document names, a first-line caption (maximum 60 characters) or a MIME,
date and message-ID fallback. MIME-derived extensions also inform file icons.
Native listings use message dates as RFC3339, reject non-file media and apply the
same fallback policy while preserving already indexed application rename labels
and all encrypted-metadata redaction. Invalid service/empty ghost rows are filtered
from visible results without deleting Telegram messages or rewriting remote data.

Nine scoped native preview/cache process journeys pass. The wider thumbnail-name
filter also included six video-upload codec tests that could not reach upload
preparation because FFmpeg is not installed; the isolated diagnostic explicitly
returned VIDEO_THUMBNAIL_UNAVAILABLE. Those outcomes are not counted as passes.
