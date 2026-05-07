# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest  | ✅        |
| older   | ❌ — please upgrade |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Send a description of the issue to **security@slothlabs.org**. Include:

- Type of vulnerability (e.g. credential leak, arbitrary code execution, privilege escalation)
- Path to the affected code (file + line numbers if possible)
- Steps to reproduce
- Potential impact

We aim to acknowledge reports within **48 hours** and provide a fix within **14 days** for critical issues.

We will credit you in the release notes unless you prefer to remain anonymous.

## Scope

In-scope:
- Credential storage and handling (macOS Keychain, AWS credential files)
- Tauri IPC commands (unauthorized command invocation)
- Update mechanism (supply chain / MITM attacks)
- Frontend XSS / content injection

Out of scope:
- Physical access attacks
- Social engineering
- Vulnerabilities requiring a compromised OS

## Security Architecture

- AWS credentials are held in memory only during an active session
- SSO tokens are stored in the macOS Keychain (encrypted) and mirrored to `~/.aws/sso/cache/` for AWS CLI compatibility
- Auto-updates are signed with Ed25519; Tauri verifies the signature before installing
- The app does not phone home or collect telemetry of any kind
