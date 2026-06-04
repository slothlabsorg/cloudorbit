# Changelog

All notable changes to CloudOrbit will be documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.3] — 2026-06-03

Test release — same features as 1.0.2. Install 1.0.2 first to test the in-app update flow.

### Improvements

- **Check for updates button** — gear/refresh icon in the titlebar lets you manually trigger an update check at any time.
- **Persistent update reminder** — the "update available" bell entry now has an × to permanently dismiss it; clicking "Later" only closes the modal, the bell reminder stays.
- **Scoped update modal** — `data-testid="updater-modal"` added; all E2E tests now scope to the modal container (fixes false positives from the Orbit inline banner).

---

## [1.0.2] — 2026-06-03

### Improvements

- **Check for updates button** — gear/refresh icon in the titlebar lets you manually trigger an update check at any time.
- **Persistent update reminder** — the "update available" bell entry now has an × to permanently dismiss it; clicking "Later" only closes the modal, the bell reminder stays.
- **Scoped update modal** — `data-testid="updater-modal"` added; all E2E tests now scope to the modal container (fixes false positives from the Orbit inline banner).

---

## [1.0.0] — 2026-05-09

First public release.

### New Features

**AWS SSO**
- Device-code SSO login flow — opens the system browser, polls for approval,
  caches tokens in the Keychain (+ `~/.aws/sso/cache` for AWS CLI compatibility).
- Discovers accounts and roles under the SSO portal and writes proper
  `[sso-session]` / `[profile ...]` entries to `~/.aws/config`.
- Add Connection wizard walks through AWS → SSO → URL/region/alias with
  real validation (registers OIDC client, lists accounts, saves profiles).

**Sessions**
- Assume-role with temporary STS credentials, written to `~/.aws/credentials`
  under `{accountId}-{roleName}`.
- Expiry countdown with per-session notifications at 30 / 15 / 5 minutes
  (native OS notification on macOS/Linux/Windows).
- Renew individual or multiple sessions from the Sessions screen.
- One-click AWS Web Console sign-in with the active session's credentials.

**EKS**
- Cluster discovery from the Clusters screen and from session/account detail
  panels. Lists name, status, version, ARN, region.
- Activate a cluster to merge it into `~/.kube/config` as the current-context.
- Production clusters require explicit confirmation before activation.

**UX**
- Accounts screen grouped as SSO → account (accordion) → roles, sorted
  alphabetically. Scales to many SSOs and many accounts per SSO.
- SSO section header shows `{directoryId} · {alias}` — the user-given alias
  is editable inline from a pencil button next to the label, and persists
  to localStorage across restarts.
- Per-role favorites with star button, right-click context menu, and
  localStorage persistence. Favorited roles pinned to the top of their
  account; accounts with favorites auto-expand.
- Editable environment tags per account — click the env badge to pick
  prod / staging / dev / sandbox / unknown, or pick **Custom…** for a
  free-form label + color. The popover is portaled with `fixed`
  positioning so it no longer gets clipped by the accordion.
- Resizable columns in the Sessions table with drag handles, persistence,
  and a reset-to-defaults affordance.
- ⌘K command palette for fast navigation and session switching.
- Detail panel on the right shows credentials, clusters, and recent activity
  for the selected session, with inline cluster detection.

**Orbit overview (redesigned)**
- Dashboard hero: Connections · Accounts · Active · Expiring · ★ Favorites
  tiles, each clickable to jump to the relevant filter.
- Live session-timeline chart — one bar per active session coloured by
  urgency (green → amber at 15 min → red at 5 min). Ticks every 15 s.
- Tabs: Active / Favorites / Recent, each with its own card grid and a
  friendly sloth-mascot empty state.
- Role cards with quick actions: Start / Renew, Open AWS Console, Copy
  credentials (as `export AWS_*=...`), Detect EKS, and a cluster-peek
  showing up to 3 detected clusters per card.

**About & footer**
- Dedicated About window opened from the CloudOrbit app menu — sloth
  mascot, version (read from `package.json` / `CARGO_PKG_VERSION`),
  tagline, and direct links to slothlabs.org, GitHub, Ko-fi. Replaces the
  plain macOS About panel with something branded and cross-platform.
- Persistent "Made by SlothLabs · ☕ Support · v{version}" strip in the
  status bar — always-visible attribution + funding link.

**Settings**
- Every toggle / select persists to localStorage under `cloudorbit.settings.*`.
  Previously the state was held only in React and reset on screen navigation.
- Active Settings section persists too — re-open Settings and you land
  back on the same subpage.
- About panel shows the real bundle version (was hardcoded `0.1.0`).

**Platform**
- macOS build with transparent titlebar overlay and native traffic lights.
- Windows / Linux builds with custom min/max/close window controls.
- Tauri-native window drag via `startDragging()` + the new `start-dragging`
  capability. Works consistently across all three OSes.
- Auto-updater plugin wired through a popup so updates can be installed
  in-place.
- Release workflow produces macOS (ARM64 + Intel), Windows (MSI), and Linux
  (.deb + .AppImage) artifacts via `tauri-apps/tauri-action`.

### Networking

- Replaced the default rustls HTTP client with a hyper + native-tls client
  for every AWS SDK call (`sso`, `credentials`, `eks`, `ec2`). Corporate
  SSL-inspection proxies (Zscaler, Netskope, Cloudflare Zero Trust, etc.)
  that inject their own root CA into the system keychain are now trusted
  transparently — rustls alone failed with `UnknownCA`.
- `open_external_url` + `notify` Rust commands for system-browser links
  and OS notifications; native on macOS (`open` / `osascript`), Linux
  (`xdg-open` / `notify-send`), and Windows (`cmd start` / PowerShell toast).

### Bug Fixes

- Fixed wizard validation that faked SSO flow with `setTimeout` — it now
  runs the real device-code → poll → list-accounts → write-config sequence.
- Fixed `lib/tauri.ts` invoking commands with snake_case JS keys; Tauri 2
  auto-maps camelCase JS ↔ snake_case Rust, so snake-case from JS hit
  validation with "missing required key startUrl".
- Fixed session detail panels showing a dead "Detect Clusters" button
  that never called anything.
- Fixed selected-session state going stale after cluster detection — the
  detail panel now re-renders with fresh `clusters`.
- Surfaced full AWS SDK error source chain to the UI instead of the
  default "dispatch failure" / "service error" placeholders.
- Fixed account names rendering with the role suffix appended
  (`polaris-development-PolarisReadOnly`). `accountNameFrom(profile)`
  normalises all three historical shapes: explicit `accountName` field,
  `"A / B"` wizard display string, and `"A-RoleName"` from `parse_config`.
- Fixed env tag popover being clipped by the accordion's `overflow-hidden`.
- Fixed Settings toggles losing their value on screen navigation.
- Fixed `Profile.accountName` leaking into session state and contaminating
  the grouped view header.

[1.0.0]: https://github.com/slothlabsorg/cloudorbit/releases/tag/v1.0.0
