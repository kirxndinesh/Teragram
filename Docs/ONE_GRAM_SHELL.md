# Teragram Material 3 shell

Historical shell notes. Current macOS behavior, including removal of floating navigation, is documented in [Teragram macOS polish](ONEGRAM_MAC_POLISH.md).

Implemented 26 October 2026.

The desktop uses a stationary, borderless header/sidebar surface (`#1E1F20` dark, `#F8FAFD` light) around a separate 24px rounded workspace (`#131314` dark, white light). The workspace owns vertical scrolling, including the heading, filters, folder shortcuts and virtualized file list. Photos retains masonry and lazy thumbnails. Folder shortcut overflow menus call the existing navigation, rename and deletion handlers.

## Navigation

- Expanded sidebar: 256px, 32px brand mark, 20px medium brand title, 56px New button and 36px navigation pills.
- Rail: 68px, 48px New button, 40px icon controls and immediate portal tooltips. The workspace expands with the rail.
- Header toggle and Cmd/Ctrl+B switch sidebar states. Typing controls and modal dialogs retain their keyboard shortcuts.
- Settings → General → Appearance & Startup → Float Sidebar enables an elevated panel revealed near the left 16px edge or by the header trigger/shortcut. It hides after pointer departure, supports Escape/focus return, and is inert while hidden. Open menus and keyboard focus prevent premature dismissal.
- `sidebarCollapsed`, `floatSidebar` and `foldersExpanded` persist through the existing settings store. Missing/invalid values migrate to defaults. Floating mode preserves the separately stored rail preference.
- New owns Upload File, Upload Folder and Create Folder. Full-window drag/drop and the existing transfer/encryption handlers remain wired. List/Grid moved to a segmented control inside the workspace.
- Removed the unused library launcher. The existing selected-file organization event remains functional.

## Branding

Display text, login/About screens, tray/localized labels, sharing pages, package display metadata and native window/product names use Teragram. The provided vector is imported as `public/one-gram-logo.svg`; the favicon and legacy logo alias use the same artwork.

`src-tauri/one-gram-icon.svg` centers the artwork on a square canvas without stretching it. Tauri's icon generator produced PNG, ICO and ICNS assets in `icons-one-gram`; desktop defaults also receive the new artwork. Both local and base Tauri configurations use the new product/window name. The built macOS Info.plist confirms Teragram for CFBundleName/CFBundleDisplayName.

Stable bundle identifiers, account/session paths, secure credential namespaces, Telegram metadata markers, update trust keys, URLs and supporter entitlement contracts are unchanged. Rebranding does not migrate or reset the current local profile. Nothing was published or deployed.

## Verification

- **55 browser E2E journeys passed** through the application UI with controlled Telegram/Tauri boundaries. Coverage includes both themes, accessibility audits, fixed chrome, rail persistence and tooltips, keyboard shortcuts, floating reveal/dismiss/restart, New menu actions, folder actions and a 320-file virtualized list scrolled to its last row. Existing authentication, account isolation, preview, media, sync settings and upload-protection journeys also passed.
- **10 native E2E notification/tray journeys passed** using synthetic state, including all native catalogs, language changes, privacy and restart behavior.
- **27 supporter Worker E2E journeys passed** against local HTTP/D1 with simulated payment transport. Service typecheck and Wrangler's non-publishing deployment dry run passed.
- TypeScript/Vite production build, bundle checks, localization structure/plurals/variables and literal-debt checks, app security checks, Rust formatting and E2E policy check passed.
- Local macOS debug bundle built and opened. Native accessibility inspection confirmed the Teragram window/menu and working workspace with the existing profile.
- Real Telegram transfer acceptance, production payments, installed-app update migration, Windows/Linux builds and Android device acceptance were not rerun for this shell change.

## Performance review

No dependency, third-party font/image request or hosted service was added. The SVG is bundled locally; media modules remain lazy. Virtualized rows now observe the workspace scroll element with a measured heading offset. Rail/floating animation honors reduced-motion preferences.

Final measured production output:

| Asset boundary | Bytes | Reviewed ceiling |
|---|---:|---:|
| Initial JavaScript | 494,880 | 513,000 unchanged |
| Total JavaScript | 2,397,289 | 3,300,000 unchanged |
| Desktop route with shared imports | 313,188 | 315,000 |
| Total CSS | 184,682 | 185,500 |
| All locale catalogs | 1,988,396 | 1,990,000 |
| Largest locale catalog | 141,373 | 142,000 |

The modest route/CSS increases cover sidebar state/focus behavior, tooltips, menus, and the requested Material shell geometry. Eleven new labels are translated into the 24 supported locales. Feature chunk ceilings and all enforcement remain enabled.

## Fixture screenshots

These screenshots use synthetic files, not account content.

![Teragram dark Photos shell](screenshots/one-gram/dark.png)

![Teragram light Photos shell](screenshots/one-gram/light.png)
