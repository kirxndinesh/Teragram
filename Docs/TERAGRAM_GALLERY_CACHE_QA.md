# Gallery navigation cache verification

27 October 2026. Scope: macOS Teragram; no Windows/Android work or publication.

## Changes

- Account-scoped catalog and folder indexes live in the shared React Query cache. Ordinary navigation, reconnect/focus and category changes do not refetch a warm index. Empty indexes are cached too. Explicit sync, mutations, vault events, folder membership changes and owned inventory events remain invalidation paths.
- Catalog reconciliation retains existing rows. React Query structural sharing preserves unchanged file arrays. Search facets and category pills filter the same index in memory, including with all-folder search enabled. Keyword searches retain debounce/cancellation and have a finite inactive-cache lifetime.
- A session gallery cache retains resolved media URLs, ready/unavailable state, dimensions, video duration and original-upgrade status. Restored cards start ready and skip entrance/skeleton transitions. Card unmount does not revoke a URL. The URL/geometry store has a 128 MiB budget including metadata allowance, independent of the smaller decoded-thumbnail LRU; the separate original/thumbnail cache retains its decoded-footprint accounting and budgets.
- View memory preserves scroll offsets, category/view preferences, allocated-folder filtering, pagination and the measured content envelope. Layout-phase restoration uses cached dimensions before paint. Width/zoom changes and actual content changes invalidate the old height floor. Stable empty-array defaults avoid unnecessary full-catalog filtering and layout resets.
- Owned inventory changes invalidate thumbnails only in the affected folder. Existing frames remain visible while replacements arrive. Pending source responses remain generation-guarded, including replacement with the same filename/size. Foreign account inventory events do not refresh the active index.
- Account changes purge foreign file/search queries and reset gallery memory. Vault lock cancels pending catalog work, withdraws decrypted rows and clears presentation frames; late responses cannot restore them. Cache clearing in Settings also clears presentation frames.
- Remote Upload and Keyboard Shortcuts load on demand to keep the desktop route under its existing byte ceiling. No dependency, font, remote asset or telemetry endpoint was added.

## Verification

- Full desktop browser suite: **101 passed**. These exercise the real application with controlled native/Telegram boundaries, not live Telegram transfer assertions.
- Ten gallery regressions cover no-read/no-loading-flash returns, first-frame scroll restoration, category filtering, navigation after the old five-minute cache window, background reconciliation, foreign events, deep pagination, vault lock, account round trips, unavailable video thumbnails and a 270-item library that exceeds the decoded-thumbnail LRU.
- Deep pagination/scroll stress journey: **8 repeated passes** after fixing the transient shorter-page clamp. Scroll is captured at the actual navigation boundary because initial thumbnail arrival can legitimately move browser scroll anchoring before the user leaves.
- Production frontend/TypeScript, localization (24 catalogs), app security configuration, workflow protection checks, E2E-only test policy and diff whitespace checks passed. Workflow execution itself remains unrun. Bundle ceilings were not increased.
- Final measured assets: initial JavaScript 492281 bytes; desktop route 320258 bytes; total JavaScript 2426519 bytes; CSS 201502 bytes. Separate URL-cache accounting is constant-time per insertion rather than scanning all cached cards.

First visits, explicit cache clearing and real inventory/vault changes still perform necessary loading. This change removes foreground reloads for warm navigation; it does not promise a literal zero-duration browser paint or unlimited decoded bitmap retention under memory pressure.

Native command implementations were not changed; older native/service suite results remain prior evidence and were not rerun for this frontend cache change.

## macOS handoff

The optimized macOS build completed successfully at `app/src-tauri/target/release/bundle/macos/Teragram.app` and was opened with the existing Telegram account intact. The live Photos gallery rendered and coordinate scrolling worked. An initial accessibility-container scroll timed out; the coordinate fallback succeeded. User navigation subsequently interrupted the manual return-to-gallery check, so that interruption is not counted as native pixel-accurate scroll verification. First-frame restoration/no-loading assertions are covered by the browser journeys and repeated deep-scroll checks above. The rebuilt app remains open in the user's current view. No live files or channels were created, imported, changed or deleted during this check.
