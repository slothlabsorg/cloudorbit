# Contributing to CloudOrbit

Thank you for taking the time to contribute! CloudOrbit has three independent layers — you can improve the UI without touching Rust, and add AWS features without touching the frontend.

---

## Table of Contents

1. [Project structure](#1-project-structure)
2. [Setting up your dev environment](#2-setting-up-your-dev-environment)
3. [Adding a new AWS feature end-to-end](#3-adding-a-new-aws-feature-end-to-end)
4. [Working on the Rust backend](#4-working-on-the-rust-backend)
5. [Working on the frontend](#5-working-on-the-frontend)
6. [Running tests](#6-running-tests)
7. [Code style](#7-code-style)
8. [Opening a pull request](#8-opening-a-pull-request)
9. [Good first issues](#9-good-first-issues)

---

## 1. Project structure

```
cloudorbit/
├── src-tauri/              Rust backend (compiled to a native binary)
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs         Registers all Tauri commands
│       └── commands/       One file per feature domain
│           ├── config.rs   Parse ~/.aws/config
│           ├── sso.rs      SSO login, token cache, account/role listing
│           ├── credentials.rs  Assume role, write credentials
│           ├── eks.rs      List EKS clusters, update kubeconfig
│           ├── ec2.rs      List EC2 instances, open SSM session
│           └── console.rs  Federated AWS Web Console
│
├── src/                    Frontend (React 18 + TypeScript + Tailwind)
│   ├── App.tsx             Root component, routing, state
│   ├── screens/            One file per top-level screen
│   ├── components/         Reusable UI components
│   ├── lib/                Utilities (api bridge, time helpers)
│   ├── types/              Shared TypeScript types
│   └── mock/               Mock data for browser-mode development
│
└── tests/                  Playwright tests (interactions + screenshots)
```

### How the frontend talks to the backend

Every Tauri command call goes through `src/lib/tauri.ts`:

```
Screen component → api.methodName() → invoke('rust_command_name', { snake_case_args })
```

The `api` object is the only place `invoke` is called directly.

---

## 2. Setting up your dev environment

### Prerequisites

```bash
# macOS — Xcode CLI tools (required for Rust compilation)
xcode-select --install

# Rust (via rustup — do not use Homebrew Rust)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustc --version   # 1.78+

# Node 18+ — pick one:
brew install node          # Homebrew
# or: https://github.com/nvm-sh/nvm  (nvm install --lts)
node --version    # 18+
```

### Clone and run

```bash
git clone https://github.com/slothlabs/cloudorbit
cd cloudorbit

npm install
npm run tauri dev    # Vite dev server + Rust auto-recompile
```

The first Rust compilation takes 2–3 minutes. Subsequent runs take a few seconds.

### Browser-only mode (no Tauri)

The frontend has mock data and can run in a regular browser:

```bash
npm run dev
# Open http://localhost:1420?mock=1
```

Useful for UI work without recompiling Rust.

---

## 3. Adding a new AWS feature end-to-end

Here's the full four-step recipe using **S3 bucket listing** as an example.

### Step 1 — Add the SDK crate

`src-tauri/Cargo.toml`:
```toml
aws-sdk-s3 = "1"
```

### Step 2 — Write the Rust command

`src-tauri/src/commands/s3.rs`:
```rust
use serde::Serialize;
use aws_config::Region;
use aws_credential_types::Credentials as AwsCreds;
use aws_sdk_s3::Client;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Bucket {
    pub name:   String,
    pub region: String,
}

#[tauri::command]
pub async fn list_s3_buckets(
    region: String,
    access_key_id: String,
    secret_access_key: String,
    session_token: String,
) -> Result<Vec<Bucket>, String> {
    let creds = AwsCreds::new(
        access_key_id, secret_access_key, Some(session_token), None, "cloudorbit",
    );
    let cfg = aws_config::defaults(aws_config::BehaviorVersion::latest())
        .region(Region::new(region.clone()))
        .credentials_provider(creds)
        .load().await;
    let client = Client::new(&cfg);
    let resp = client.list_buckets().send().await.map_err(|e| e.to_string())?;
    Ok(resp.buckets().iter().map(|b| Bucket {
        name: b.name().unwrap_or_default().to_string(),
        region: region.clone(),
    }).collect())
}
```

**Rules:**
- Return `Result<T, String>` — the `String` is shown to the user as an error.
- Use `#[serde(rename_all = "camelCase")]` so fields arrive as camelCase in TypeScript.
- Inject credentials via `AwsCreds::new(...)` — never rely on ambient env vars.

### Step 3 — Register the command

`src-tauri/src/commands/mod.rs`:
```rust
pub mod s3;
```

`src-tauri/src/main.rs`:
```rust
.invoke_handler(tauri::generate_handler![
    // ...existing commands...
    commands::s3::list_s3_buckets,
])
```

### Step 4 — Wire up the frontend

`src/lib/tauri.ts`:
```ts
listS3Buckets: (region: string, accessKeyId: string, secretAccessKey: string, sessionToken: string) =>
  invoke<Bucket[]>('list_s3_buckets', { region, access_key_id: accessKeyId, secret_access_key: secretAccessKey, session_token: sessionToken }),
```

Then create `src/screens/S3.tsx` following the pattern of `Clusters.tsx` or `Sessions.tsx`.

---

## 4. Working on the Rust backend

```bash
# Run all Rust commands from the src-tauri/ directory
cd src-tauri
cargo check      # fast type-check (no binary)
cargo clippy     # linter
cargo fmt        # formatter — always run before committing
cargo test       # unit tests
```

### Error handling

```rust
// Good — short, actionable
.ok_or("Not logged in — click a profile to authenticate")?

// Avoid — cryptic stack traces
.map_err(|e| format!("{e:?}"))?
```

---

## 5. Working on the frontend

### Design tokens

All colors use Tailwind classes wired to CSS variables defined in `tailwind.config.ts`. Use semantic tokens:

```tsx
// Correct
<div className="bg-bg-elevated border-border text-text-primary">

// Avoid
<div style={{ background: '#1a1b1e', color: '#f0f0f8' }}>
```

### Adding a new screen

1. Create `src/screens/MyScreen.tsx` — export a named component.
2. Add the screen ID to the `Screen` union in `src/types/index.ts`.
3. Add a `case 'my-screen'` to `renderScreen()` in `App.tsx`.
4. Add a nav item to `Sidebar.tsx`.

### Framer Motion conventions

- Entrance: `initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}`
- Exit: wrap list items in `<AnimatePresence>` with `exit={{ opacity: 0, x: -4 }}`
- Modals: spring `transition={{ type: 'spring', stiffness: 340, damping: 28 }}`

---

## 6. Running tests

```bash
# Unit tests (Vitest)
npm test

# Interaction tests (Playwright — auto-starts the dev server)
npm run test:interactions

# Screenshots
npm run screenshots
```

> Playwright's `webServer` config starts Vite automatically when the tests run. If the dev server is already running on port 1420 it reuses it.

Rust unit tests:
```bash
cd src-tauri && cargo test
```

---

## 7. Code style

### Rust
- `cargo fmt` before every commit — non-negotiable.
- `cargo clippy` — fix all warnings before opening a PR.
- No `unwrap()` in command functions.

### TypeScript / React
- Functional components only, no class components.
- Props interfaces defined inline above each component.
- No `any` types — use proper generics or `unknown`.
- Tailwind classes only — no inline styles except for dynamic values (widths, etc.).

### Git
- Branch: `feature/short-description` or `fix/what-was-broken`
- Commits: imperative, no emoji, no period
  ```
  Add S3 bucket listing screen
  Fix token expiry comparison for non-UTC timezones
  ```

---

## 8. Opening a pull request

1. Fork and create a branch from `main`.
2. Make your change. Run `cargo clippy`, `cargo fmt`, `npm test`.
3. Open a PR using the PR template.
4. For UI changes, include before/after screenshots.
5. For new AWS features, include the full four-step change.

> **Note on releases:** Only maintainers can publish releases. Draft releases are created automatically by CI — a maintainer will review and publish when ready.

---

## 9. Good first issues

### Small
- Expiry color urgency — yellow at `< 30 min`, red at `< 5 min`
- Account ID tooltip — show full 12-digit ID on hover
- SSM prerequisite check — verify `session-manager-plugin` is installed before opening a session

### Medium
- Region switcher — dropdown in the Sessions detail panel to switch regions
- Login waiting room — full-panel state showing the verification URL + countdown timer

### Larger
- Named profiles — support `[profile X]` entries with static credentials
- GCP support — `gcloud` auth, project/role listing (parallel to AWS SSO flow)
