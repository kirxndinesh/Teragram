# Teragram UI architecture and removal audit

Reviewed 2026-10-26. User-provided references guide the appearance; they do not
supply backend commands or account data.

## Runtime map

| Concern | Existing boundary retained | Redesigned presentation |
| --- | --- | --- |
| Authentication/session | App → native connect/check/auth/logout; OS API-hash storage | Existing credential/QR/phone flow; account settings show API ID and boolean hash status only |
| File inventory | `fileListRefresh`, React Query, account-scoped native inventory | Folder table with Name, Folder, Size, Date and context actions |
| Unified library | `useLocalFileSearch` → paginated `cmd_search_local` | My Cloud, storage categories, Photos; incomplete inventory is labeled |
| Upload | `useFileUpload` → protection workflow → durable native transfer engine | Header file/folder menu; existing full-window native drop listeners |
| Download | `useFileDownload` → destination/collision workflow → durable engine | Default directory preference, file and bulk actions |
| Media | Existing preview cache, image viewer and native streaming/adaptive player | Natural-ratio masonry, integrated lightbox actions, keyboard navigation and image zoom |
| Selection | Exact `(owner, folder, message)` identity and action-scope guards | Checkbox/modifier selection and floating bulk toolbar |
| Sync | Existing reviewed mapping planner, watcher, engine and context | Existing mappings and enable toggle, plus persisted idle interval |
| Security/integrations | Existing TDENC2/vault, cache, proxy, REST and WebDAV commands | Existing settings sections retained in the light shell |

`components/desktop/cloud/` contains the modular sidebar, storage widget/popover, file
browser, media gallery, allocation controls, connection menu, preferences,
lightbox actions and bulk toolbar. Dashboard orchestration retains native event
listeners and mutation ownership checks.

Photo allocations are persisted in `photoFolderAllocations[verifiedOwnerId]`.
An absent value includes all folders; an empty array includes none. Search/gallery
responses and thumbnail cache invalidations remain scoped to the current account.
Selection keys include folder ID because Telegram message IDs can collide across
channels. Shift selection resolves its anchor in the visible sort order.

## Settings additions

- Light default, with persisted Dark/System modes and curated/custom accent colors.
  The broken Default mode, preset grid and custom-theme editor are removed.
- Startup My Cloud/Photos/Recents; thumbnail scaling 50–200%.
- Download directory uses the native picker and existing destination/collision
  confirmation, rather than bypassing transfer checks.
- API hash status uses new `cmd_has_api_hash`, returning a boolean only.
- New `cmd_set_sync_interval` validates the verified owner and a 30–3600 second
  range, persists through the existing guarded sync settings transaction and
  restarts the engine. Defaults preserve the upstream 30-second full scan and
  5-minute incremental idle polling. Watcher-triggered changes remain immediate
  after their existing debounce; this setting controls idle reconciliation.
- Uncompressed folder upload uses `cmd_list_upload_folder`, bounded to 10,000
  regular files, rejecting symlinks and filesystem errors. Files then enter the
  existing protection and queue workflow. Telegram channels remain flat;
  compressed folder upload preserves relative directory structure in a ZIP.

## Advertising removal

Removed from frontend runtime and source:

- AdGateway/AdsterraBanner/DesktopAdBanner and sponsor-link helpers.
- Supporter context, offer dialog, settings section and mobile card.
- Login gateway state, ad acknowledgement persistence, promotion timers,
  transfer-triggered value-moment prompts and related settings fields.
- Advertising browser fixtures and design-gallery placements.

Removed from native application:

- Loopback ad routes, script relay/cache/fetches and separate ad-server lifecycle.
- Sponsor subframe link bridge and plugin registration.
- Sponsor port in startup health.

Supporter IPC module/handler registration is excluded from `tg-drive-local`.
Historical payment-service/recovery implementation and upstream documentation
remain in the repository; Teragram does not import, invoke or compile those
entitlement handlers, and access never depends on a paid status. Existing
purchasers' external service records, recovery rights and credentials are not
changed. No checkout, service deployment or entitlement mutation was performed.
Old upstream ad/payment-specific acceptance suites are historical contracts, not
Teragram's launch path. The TG suite checks that an unpaid fresh session neither
requests supporter/sponsor commands nor mounts ad frames.

## Verification boundary

All 49 Teragram browser E2E journeys pass using a controlled native/service boundary. Tests
exercise the real app entry point, providers, components and interactions. They
cover account changes, vault events, source-safe mutations and storage failures;
these are not live Telegram transport or Keychain acceptance.

The isolated macOS debug app builds locally and has connected to the existing
Telegram session. Real transfers, encryption recovery and codec/transport coverage
remain manual acceptance in the architecture report. Browser media checks decode
a real generated MP4; other Telegram/native responses use controlled fixtures.

Two targeted native E2E journeys also pass through a separate backend process
and real loopback HTTP: removed `/ad-banner` and `/ad-script` routes return empty 404
responses, the separate ad-server command is unavailable, and the media server retains
preferred-port and fallback binding. The full native
suite and live Telegram transport were not run as part of this UI verification.

## Photos/Notion polish (2026-10-26)

The right storage column is replaced by a compact sidebar widget and category
popover. Neutral dark tokens replace navy surfaces, with borderless search,
header icons and active navigation pills. `accentTheme.ts` derives persisted
accent tint, hover, foreground and accessible text colors before first render.

`cloud/MediaChrome.tsx` owns the single immersive viewer and controls for image,
native, MSE and HLS stages. Existing authenticated streaming URLs, playback
persistence, fallback selection and encryption ownership guards remain. No native
`controls` attribute or secondary history/shortcut toolbar is rendered. The HUD
hides after 2.5 seconds of inactivity while playing, and wakes on pointer/keyboard
input. Active keyboard operation, editing and open info menus keep it visible.

`galleryMediaMetadata.ts` caps metadata concurrency at two, caches at most 256
entries and rejects results after account/cache-generation changes. Existing
authenticated thumbnail transport remains; rendition selection and output size
now favor high-DPI sources. Black decoded video frames and unavailable
previews receive explicit media placeholders instead of empty cards. The duration
badge only displays native metadata when known.

## Rendering/data-display follow-up

The shell now uses a bounded search group and a separate right-aligned toolbar.
Settings removes its General theme duplicate, aligns the control rail and reserves
space above the footer. The shared viewer defaults to a glass popup with explicit
fullscreen and reduced-motion-aware opening, navigation and closing transitions.
Original image transport remains independent of the initial cached thumbnail.

Grid rendition keys are versioned independently from original previews. Highest
pixel-area Telegram sizes replace the old near-60KB selection; generated JPEGs
fit 1600×1600 without upscaling, retaining existing cache/decoder/account guards.
Cached original paths, their verification, and encrypted-data restrictions remain.

Native inventory labels now use document/caption/MIME fallbacks and RFC3339
message timestamps. An existing indexed rename matching its Telegram caption is
preserved as the file.name override. Frontend normalization also handles older
cached records and rejects empty/service ghost rows. These are display changes;
no user message, file or channel is renamed/deleted as part of normalization.
