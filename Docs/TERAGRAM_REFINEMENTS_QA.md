# Teragram v1.0 refinement verification

Completed 27 October 2026. The macOS app was rebuilt at `app/src-tauri/target/release/bundle/macos/Teragram.app` and opened with the existing Telegram session intact. Windows/Android conversion and publication remain paused. No source push or remote deployment occurred.

## Implemented

- Quick Access toggles its tree from the entire row without navigating. Folders opens the overview on its first label click, then toggles its tree when already selected; its trailing chevron independently toggles the tree. Both chevrons appear on row hover or keyboard focus and remain hidden in the collapsed rail. Leading navigation icons align.
- All workspace controls use unclipped 36px geometry with 10px corners. The List/Grid wrapper no longer has the old 32px clipping height or divider border. Keyboard focus indicators are retained.
- Image navigation keeps the same viewer mounted, with a stable bounded frame. Both neighboring images use the account-bound, memory-bounded preview cache. The old image remains visible until the incoming original decodes, with guards against late decode callbacks from a different file/folder. Bandwidth-saving preferences still suppress speculative prefetch.
- The external crash-report transport, compile-time upload endpoint, pending-upload queue and consent popup are removed. Sanitized JavaScript crash shape and native panic events go only to the rotating, redacted device log. Settings → Privacy offers Open Local Crash Logs and the owned GitHub issue link, with no automatic log attachment. Legacy reporting preferences cannot restore uploads.
- Application metadata credits Kiran Dinesh (kirxndinesh). Repository, issues and default updater metadata use the owned Teragram repository. The local macOS build keeps automatic updater endpoints disabled. Stable credential namespaces remain unchanged. Original third-party copyright and license notices are preserved.
- Tray source artwork is tightly cropped. The separate PNGs are 22×22 and 44×44, with approximately 18×18 and 36×36 glyph bounds; macOS template behavior is retained. The browser favicon is also cropped. The Dock/app icon is unchanged.
- Existing member channels, supergroups and basic groups can be searched and added from the Folders overview. The sidebar inline add button is removed; overview import/create actions use accessible 36px icon buttons with 20px icons, title tooltips and an 8px gap. Only one Folders heading remains. Visible import rows request avatars/member details through three bounded workers. Selection is capped at 100 per import and membership is reverified before mounting. Unknown counts remain unknown rather than inventing data.
- Mounts are account-scoped and survive restart. Basic group IDs occupy a distinct namespace; user dialogs cannot overwrite channel/group folder-cache entries. The picker is lazy-loaded and initially renders at most 100 rows. A local folder refresh makes a completed mount visible immediately; the existing bounded catalog jobs index its media.
- Removing an imported source only removes its local folder link. Source channel rename/delete actions are blocked in native IPC, REST and WebDAV. No Telegram channel is joined, renamed or deleted during import. Local mount removal does not delete Telegram media.
- About displays Teragram, v1.0, the requested cloud-workspace description, GitHub repository and Kiran Dinesh (@kirxndinesh).
- A startup preference race found during reduced-motion verification was fixed: performance defaults wait for saved settings to load.

## Login decision

The user explicitly chose to skip the phone-only/default-API-credentials change. The existing API setup, phone/OTP and 2FA flow remains. No shared Telegram Desktop credentials or new built-in API pair was introduced.

## Verification

| Gate | Result | Scope |
|---|---|---|
| Full browser suite | 87 passed | Actual app with controlled native/Telegram boundary; includes unchanged login, import/detach, local-only Privacy, lightbox transitions, light/dark geometry and startup preference preservation |
| Supporter compatibility | 27 passed; type check and Worker dry-run passed | Local simulated payment boundary; no deployment |
| Full native suite | 223 passed | Real processes, SQLite, HTTP, transfers, streaming, account isolation, import persistence/source guards, sanitized crash records and native panic logging |
| Strict Rust lint | Passed | `cargo clippy --features native-e2e --lib --all-targets -- -D warnings` |
| Production frontend / TypeScript | Passed | No new dependency |
| Localization and literal budget | Passed | 24 catalogs |
| Security, test policy, workflow protections | Passed | Existing release/security gates retained |
| Formatting and diff whitespace | Passed | cargo fmt, reviewed native line lengths, git diff --check |
| Bundle budgets | Passed | Initial JS 492281; desktop route 320637; CSS 201069; locale total 2019160 bytes. Lazy channel picker about 4KB |
| Native macOS launch | Passed | Existing account, folders and preferences visible |
| Live channel discovery | Passed | Available member sources and counts displayed; none selected or mounted during manual QA |
| Native Privacy | Passed | Local-only copy and Open Logs / owned GitHub issue controls visible |

The log-opening IPC and controlled local logging are covered by browser/native journeys. Desktop automation was interrupted during a Finder check; that interruption is not counted as successful Finder-window verification. Actual mount/detach writes were exercised with synthetic fixtures, not by altering the user's real Telegram channels.

The build is local, not a notarized/public distribution. FFmpeg remains absent on the Mac's application PATH; unsupported codec conversion and videos without a Telegram thumbnail can still require that dependency. Existing media codec and platform-release limits are recorded in `TERAGRAM_V1_QA.md`.

## Sidebar and Folders follow-up

The follow-up browser run passed all 91 journeys, including four new light/dark regressions added before implementation. They cover hidden/hover/focus chevrons, whole-row Quick Access toggling, repeated Folders selection, independent folder disclosure, Enter/Space activation, the single overview heading, exact icon geometry and both folder dialogs. Native button activation now stops the workspace file-opening shortcut from swallowing Enter/Space inside sidebar navigation.

The production frontend/TypeScript build, 24-catalog localization checks, test-policy check, app security configuration, workflow protection check, and diff whitespace check passed. Bundle budgets passed without increasing limits: initial JS 492281 bytes, desktop route 320880 bytes and CSS 201457 bytes. Browser journeys use controlled Telegram/native fixtures; the fixture now supplies the native channel-list command's empty-array result. Native/backend behavior is unchanged by this follow-up, so the earlier native/service results above are prior evidence, not reruns for this UI change.

The optimized macOS application bundle rebuilt successfully and was reopened with the existing account. Native checks confirmed Quick Access expand/collapse without navigation, the Folders first/repeated-click behavior and independent disclosure, the single overview heading, and working import/create icon triggers. Both dialogs were cancelled without creating channels or mounting sources. The updated app was left open on Folders.

## Unified category/filter pills

The later pill refinement follows the user's final transparent-inactive specification. Photos folder filters and every shared category bar use `cloud-filter-pill`: 36px height, 16px inline padding, 14px medium text, full capsule corners, no border/shadow, shared sidebar inactive colors, theme-specific translucent hover fills and the existing accent tint/text. A keyboard-only focus ring remains. The redundant Files section heading is removed from My Cloud, Saved Messages, folders and Quick Access views.

Existing light/dark browser journeys were extended before implementation to cover geometry, inactive/hover/selected styling, sidebar color parity and heading removal across those views. Both failed against the old styles and passed after the change. The complete desktop browser suite passed all 101 journeys; dark My Cloud and light Photos screenshots were visually reviewed. Production frontend/TypeScript, localization, app security, test-policy and diff checks passed. Bundle budgets passed unchanged: desktop route 320237 bytes; CSS 201428 bytes; initial JS 492281 bytes. No backend, cache or transfer behavior was changed in this styling pass.

The macOS production app rebuilt successfully and was reopened with the existing account. Its live Photos screenshot confirms the transparent inactive filters and accent capsule. Additional manual navigation was interrupted by the user-navigation guard and is not counted as completed native cross-view verification; cross-view style checks passed in the browser suite. The updated app remains open.

## Folder dialog refinement

Create Folder and Add Existing Channel now share scoped modal, button and footer rules. The create form is capped at 440px, stacks the label above its 42px input, wraps the explanatory callout, and scrolls its body on short windows. The channel search input stays transparent in both themes, with a focus indication on its outer pill. Channel rows remain native clickable labels, with theme-aware 20px checkboxes, a white SVG tick, selected/hover fills, a 320px maximum list height and fixed header/footer. Singular member copy is supplied in all 24 catalogs; the existing plural copy remains for other counts. Import bounds, avatar workers, native commands and account/source guards are unchanged.

Four E2E regressions were added before implementation and reproduced the original dark/light issues. They now verify field/callout bounds at 1000×650 and 500×500, disabled/enabled buttons, footer spacing, transparent focused search, singular/plural text, full-row and keyboard selection, list scrolling without footer movement, and successful create/import requests at the controlled native boundary. The full desktop suite passed **105 tests**. Light Create Folder and dark selected-channel screenshots were visually reviewed.

Production frontend/TypeScript, localization, test policy, app security, workflow protection configuration and diff whitespace checks passed; workflow execution remains unrun. Obsolete sidebar/header selector rules were pruned to retain the existing bundle ceilings. Final CSS is 200855 bytes, desktop route JS 319519 bytes, initial JS 492281 bytes and locale data 2019716 bytes. No budget limits or dependencies changed. These browser checks do not create or import real Telegram channels.

The macOS app rebuilt and reopened successfully. The native Create Folder dialog was visually checked and cancelled without creating a channel. Native Add Existing Channel verification was interrupted by the user-navigation guard; the two-theme browser checks above cover that dialog's layout and controlled import request.

## Transfer banner completion lifecycle

The floating Transfers banner now confirms successful completion with a green check and “All transfers complete” for 2.5 seconds, then fades/slides out over 220ms. Hovering or keyboard focus protects it from automatic dismissal; leaving after the deadline gives a further one-second grace period. Queued, active, paused, failed, network-waiting, unlock-waiting, cooldown and verification work prevents automatic hiding. Cancelled/skipped jobs may disappear with a neutral summary, without claiming success. New jobs, retries, attention-state changes and explicit tray navigation reveal the banner again; ordinary progress updates do not resurrect a manually dismissed banner. A Close action is available for completed or collapsed banners. Reduced-motion preferences suppress the slide/fade.

Dismissal clears only local banner presentation state, with account/direction/job-specific identities. It never calls the durable ledger cleanup or cancellation APIs. Manual Clear finished retains its established native cleanup behavior. No transfer engine, Telegram uploader, account/session or credential code changed in this pass.

Eleven banner E2E journeys cover deadlines, hover, keyboard focus, cancellation/skipping, mixed upload/download queues, interrupted exits, retry, manual close, progress updates, tray reopening and reduced motion through controlled native events. The initial six regressions reproduced five lifecycle failures before implementation (the existing attention-state check already passed). Both existing Clear finished E2E journeys were added to the Teragram desktop configuration. The complete suite passed **118 tests**. These are browser/native-boundary fixtures, not a new real Telegram upload/download validation.

Production frontend/TypeScript, 24-catalog localization, test policy, app security, workflow protection configuration and whitespace checks passed. Bundle checks passed unchanged ceilings: CSS **201320** bytes, desktop route JS **321554** bytes, initial JS **492281** bytes, locale data **2019716** bytes. No new dependency or budget increase was introduced.

The completion-banner screenshot was visually reviewed in a controlled browser journey. The production macOS application bundle built successfully, was reopened with the existing account, and reached Photos. It is left open. No new real Telegram transfer was queued solely for QA.


## Bulk-upload library refresh recovery

The red library error can be reproduced while successful uploads invalidate a Photos search generation. The old local search client abandoned `SEARCH_CHANGED` after three attempts and did not retry `INVENTORY_CHANGED`. Every inventory event could also cancel and restart an active read. New controlled browser regressions reproduced both errors and a 175-event concurrent refresh burst before implementation; an additional folder journey reproduced the same race in an open upload destination.

Local search now retries only explicit transient generation/building/busy codes, with capped backoff and the existing 12-minute overall bound. Abort signals stop retry delays; account/vault/integrity/pagination errors remain failures. Cached thumbnails stay ready. Inventory notifications are coalesced to one active read plus a trailing refresh, including the final event during an active read. Folder listings also retry transient generation changes; upload completion invalidations no longer cancel an active folder read. Favorite/pinned metadata is updated in the owner-scoped local query cache immediately after a successful write, preserving instant Favorites navigation while catalog refreshes are batched.

The allocation dialog is now loaded on demand to keep the desktop route within its existing JavaScript ceiling. No dependency, locale, security guard or bundle limit was relaxed. The final desktop suite passed **123 E2E journeys**, including five new upload/index regressions. TypeScript/production frontend, localization, test policy, app security, workflow protection configuration and whitespace checks passed. Final bundle measurements: desktop route **321065** bytes, CSS **201320**, initial JS **492281**, locale data **2019716**. Backend/native transfer engines are unchanged; these new upload race checks use controlled native events and index responses, not a new live bulk upload.


The final optimized macOS app rebuilt and reopened with the existing account on Photos without the library error. The existing live queue was checked read-only before restarting: all 205 records were completed, so no active uploads were interrupted. No new live test upload was sent. The release copy was sealed with a complete ad-hoc signature (not Developer ID/notarization), verified using `codesign --verify --deep --strict`, and packaged as ZIP and DMG. The archive integrity and DMG checksum were verified. Release files exclude session/config databases and personal media.

The new private `kirxndinesh/Teragram` repository was created at the owner's request. Full source import remains pending approval of the eight shared compatibility files listed in `Docs/release/TERAGRAM_SOURCE_PUBLICATION.md`. The prepared local snapshot excludes native Android projects, generated resources, signing material and unapproved Android-specific scripts/screenshots. Windows/Android cross-platform builds and product-page deployment remain manual; automatic desktop QA uses the Teragram browser configuration. Workflow signature/deployment guards and scheduled dependency checks remain intact.


The owner chose macOS publication first. The private repository now contains branded documentation and a published `v1.0.0-macos-preview` release with ARM64 DMG, app ZIP, PNG/SVG logos and SHA-256 sums. The eight shared compatibility source files remain unapproved; the full source snapshot stays local. The release explicitly states that its automatic GitHub source archives currently contain documentation only. Uploaded asset digests/sizes are checked against the local build.
