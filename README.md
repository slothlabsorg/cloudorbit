<div align="center">
  <img src="public/images/logo-cloudorbit.PNG" alt="CloudOrbit" width="159" />

  <h1>
    <img src="src-tauri/icons/128x128@2x.png" alt="CloudOrbit" width="40" style="vertical-align:middle" />
    CloudOrbit — AWS Client UI for macOS
  </h1>

  <p><strong>The free, native, visual AWS client UI for developers — SSO sessions, EKS detection, kubeconfig auto-update, federated console sign-in. No terminal, no Electron, no subscription.</strong></p>

  [![Release](https://img.shields.io/github/v/release/slothlabsorg/cloudorbit?style=flat-square)](https://github.com/slothlabsorg/cloudorbit/releases)
  [![License: FSL-1.1-MIT](https://img.shields.io/badge/License-FSL--1.1--MIT-blue.svg?style=flat-square)](LICENSE)
  [![GitHub Sponsors](https://img.shields.io/github/sponsors/slothlabsorg?style=flat-square&logo=github&color=pink)](https://github.com/sponsors/slothlabsorg)
  [![Ko-fi](https://img.shields.io/badge/Ko--fi-Support-ff5e5b?style=flat-square&logo=ko-fi)](https://ko-fi.com/slothlabs)
  [![Website](https://img.shields.io/badge/web-slothlabs.org-4DA6FF?style=flat-square)](https://slothlabs.org/cloudorbit)
</div>

---

## What is CloudOrbit?

**CloudOrbit is the AWS client UI that AWS forgot to ship.** It's a free, native macOS app for engineers who juggle multiple AWS accounts, SSO roles, EKS clusters, and the web console — all in one place, without touching a terminal.

If you've used **Leapp** but hit walls behind Cloudflare Zero Trust or hated the 200 MB Electron bundle, CloudOrbit is the visual AWS session manager you've been looking for. It's built on Tauri (native WKWebView) instead of Electron, so it trusts the same certificates Safari does — corporate proxies, custom CAs, and Cloudflare Gateway all just work.

**Currently supported:** AWS · GCP and Azure on the roadmap.

## Features

- 🔐 **SSO login** — one-click authentication across all AWS accounts and roles
- ⏱️ **Session management** — track credentials, expiry, and active sessions at a glance
- ☸️ **Kubernetes / EKS** — auto-discover clusters and update `~/.kube/config` in one click
- 🖥️ **EC2 / SSM** — browse instances and open browser-based shell sessions
- 🌐 **Web Console** — federated sign-in directly into the AWS console
- 🛡️ **Cloudflare-friendly** — works behind corporate Zero Trust / SSL inspection (unlike Electron AWS tools)
- 🔄 **Auto-update** — new versions install silently in the background
- 🍎 **macOS · Windows · Linux** — single codebase, native packaging

## Install

### macOS

```bash
# Homebrew (recommended)
brew install --cask slothlabsorg/tap/cloudorbit

# Or download the .dmg from the Releases page
```

### Windows

```powershell
winget install SlothLabs.CloudOrbit
```

### Linux

Download the `.deb` or `.AppImage` from [Releases](https://github.com/slothlabsorg/cloudorbit/releases).

## Screenshots

![Orbit Overview](screenshots/01-orbit-default.png)

More: [slothlabs.org/cloudorbit](https://slothlabs.org/cloudorbit)

## Why CloudOrbit (vs Leapp / aws-vault GUI / AWS Console)

| | CloudOrbit | Leapp | AWS Console | aws-vault (CLI) |
|---|:---:|:---:|:---:|:---:|
| Works behind Cloudflare / corporate proxy | ✅ | ❌ | ✅ | ⚠️ |
| Native binary (not Electron) | ✅ Rust | ❌ Electron | N/A | ✅ |
| EKS kubeconfig auto-update | ✅ | ❌ | ❌ | ❌ |
| No terminal required | ✅ | ✅ | ✅ | ❌ |
| Free & open source | ✅ | ✅ | ✅ | ✅ |
| < 5 MB install | ✅ | ❌ 200 MB | N/A | ✅ |
| Active development | ✅ | ⚠️ | ✅ | ⚠️ |

## Development

**Prerequisites:** Rust 1.78+, Node 18+, npm

```bash
git clone https://github.com/slothlabsorg/cloudorbit
cd cloudorbit

npm install
npm run tauri dev    # Vite dev server + Rust hot-reload
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide.

## Tech stack

| Layer | Technology |
|---|---|
| Shell | Tauri v2 (native WKWebView, no Chromium) |
| Frontend | React 18 + TypeScript + Tailwind CSS |
| Backend | Rust — AWS SDK for Rust + IOKit |
| Testing | Vitest (unit) · Playwright (interaction/screenshot) |

## Roadmap

- **v0.2** — Okta / SAML IdP login (SAML-assertion intercept → role picker → temp creds)
- **v0.3** — GCP support
- **v0.4** — Azure support
- **v0.5** — Plugin system (lifecycle hooks, custom credential types, dashboard panels)

> Have a feature request? [Open an issue](https://github.com/slothlabsorg/cloudorbit/issues).

## We need your help 🙏

CloudOrbit is built by one person on nights and weekends. If you're a developer who shares the pain of multi-account AWS workflows, here's where you can help:

- 🐛 **Triage issues** — reproduce reports, add diagnostics
- 🦀 **Rust contributors** — SAML IdP flow, GCP/Azure SDK integration
- ⚛️ **React contributors** — UI polish, accessibility, keyboard navigation
- 📝 **Docs** — installation guides for less-common Linux distros
- 🌍 **i18n** — interface translations
- 🧪 **Beta testers** — particularly on Windows and on corporate networks

The tracker is wide open. Pick anything labeled `good-first-issue` or `help-wanted`.

## Sponsor / fund the project

CloudOrbit is free forever. There's no VC money — every coffee helps cover the **$99/year Apple Developer certificate** so future users get a clean install with no Gatekeeper warnings.

- ☕ [Ko-fi](https://ko-fi.com/slothlabs) — one-time or recurring
- ❤️ [GitHub Sponsors](https://github.com/sponsors/slothlabsorg) — monthly tiers
- ⭐ Star this repo — it helps others discover the project

## Other SlothLabs tools

| | | |
|---|---|---|
| ⚡ [WattsOrbit](https://slothlabs.org/wattsorbit) | Mac power monitor for the menu bar | macOS |
| 🗄️ [DataOrbit](https://slothlabs.org/dataorbit) | Native DynamoDB GUI client | macOS · Win · Linux |
| 🔍 [ProxyOrbit](https://slothlabs.org/proxyorbit) | Free Charles Proxy alternative | macOS · Win · Linux |
| 🔐 [BastionOrbit](https://slothlabs.org/bastionorbit) | SSH tunnel manager with auto-expiry | macOS · Win · Linux |
| 🧜 [Mermaid Preview](https://slothlabs.org/mermaid-preview) | Mermaid IntelliJ / JetBrains plugin | All JetBrains IDEs |

## License

Source-available under the [Functional Source License 1.1 (FSL-1.1-MIT)](LICENSE). Free to use, read, and contribute to — cannot be forked into a competing product. Converts to MIT on 2028-01-01. See [TRADEMARK.md](TRADEMARK.md) for brand usage.
