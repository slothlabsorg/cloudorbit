use std::fs;
use dirs::home_dir;
use serde::{Deserialize, Serialize};
use sha1::{Sha1, Digest};
use chrono::{DateTime, Duration, Utc};
use aws_sdk_ssooidc::Client as OidcClient;
use aws_sdk_sso::Client as SsoClient;

use crate::aws_http;

// ── SSO token cache ───────────────────────────────────────────────────────────
//
// Tokens are stored in TWO places:
//   1. System Keychain (macOS Keychain / Windows Credential Vault / Linux Libsecret)
//      → encrypted at rest, requires user password to export
//   2. ~/.aws/sso/cache/{sha1}.json  (same format as the AWS CLI)
//      → plaintext, but compatible with `aws cli`, `terraform`, etc.
//
// On read we check the Keychain first (faster, more secure), then fall back to
// the file so that tokens created by the AWS CLI are honoured automatically.

const KEYRING_SERVICE: &str = "cloudorbit";

#[derive(Serialize, Deserialize)]
struct SsoCache {
    start_url:    String,
    region:       String,
    access_token: String,
    expires_at:   String,
}

fn cache_path(start_url: &str) -> std::path::PathBuf {
    let hash = hex::encode(Sha1::digest(start_url.as_bytes()));
    home_dir()
        .unwrap()
        .join(".aws")
        .join("sso")
        .join("cache")
        .join(format!("{}.json", hash))
}

/// Short, stable key used as the "account" name in the system vault.
fn keyring_account(start_url: &str) -> String {
    let hash = hex::encode(Sha1::digest(start_url.as_bytes()));
    format!("sso-{}", &hash[..20])
}

// ── Keychain helpers (non-fatal — fall back silently) ─────────────────────────

fn store_token_in_keychain(start_url: &str, access_token: &str, expires_at: &str) {
    let account = keyring_account(start_url);
    let payload = serde_json::json!({
        "access_token": access_token,
        "expires_at":   expires_at,
    })
    .to_string();
    if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, &account) {
        let _ = entry.set_password(&payload);
    }
}

fn load_token_from_keychain(start_url: &str) -> Option<String> {
    let account  = keyring_account(start_url);
    let entry    = keyring::Entry::new(KEYRING_SERVICE, &account).ok()?;
    let payload  = entry.get_password().ok()?;
    let data: serde_json::Value = serde_json::from_str(&payload).ok()?;
    let expires: DateTime<Utc> = data["expires_at"].as_str()?.parse().ok()?;
    if expires > Utc::now() {
        data["access_token"].as_str().map(|s| s.to_string())
    } else {
        // Expired — clean up the entry
        let _ = entry.delete_credential();
        None
    }
}

// ── Public helpers ────────────────────────────────────────────────────────────

/// Read a valid (non-expired) SSO access token.
/// Checks the system Keychain first, then the AWS-CLI–compatible file cache.
pub fn read_cached_token(start_url: &str) -> Option<String> {
    // 1. Keychain (encrypted)
    if let Some(token) = load_token_from_keychain(start_url) {
        return Some(token);
    }
    // 2. File cache (AWS CLI format)
    let content = fs::read_to_string(cache_path(start_url)).ok()?;
    let cache: SsoCache = serde_json::from_str(&content).ok()?;
    let expires: DateTime<Utc> = cache.expires_at.parse().ok()?;
    if expires > Utc::now() {
        Some(cache.access_token)
    } else {
        None
    }
}

fn write_cached_token(start_url: &str, region: &str, access_token: &str, expires_in_secs: i64) {
    let expires_at  = Utc::now() + Duration::seconds(expires_in_secs);
    let expires_str = expires_at.to_rfc3339();

    // Write to system Keychain (encrypted at rest)
    store_token_in_keychain(start_url, access_token, &expires_str);

    // Write to file cache (AWS CLI compatibility)
    let path = cache_path(start_url);
    let _ = fs::create_dir_all(path.parent().unwrap());
    let cache = SsoCache {
        start_url:    start_url.to_string(),
        region:       region.to_string(),
        access_token: access_token.to_string(),
        expires_at:   expires_str,
    };
    let _ = fs::write(&path, serde_json::to_string_pretty(&cache).unwrap());
}

// ── Tauri commands ────────────────────────────────────────────────────────────

/// Returns true if a valid (non-expired) SSO token is cached.
#[tauri::command]
pub fn check_sso_login(start_url: String) -> bool {
    read_cached_token(&start_url).is_some()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub client_id:                 String,
    pub client_secret:             String,
    pub device_code:               String,
    pub interval:                  i32,
    pub verification_uri_complete: String,
}

/// Register an OIDC client, start device authorization and open the browser.
#[tauri::command]
pub async fn sso_login_start(
    start_url: String,
    sso_region: String,
) -> Result<SessionInfo, String> {
    let cfg = aws_http::config_for_region(&sso_region).await;

    let oidc = OidcClient::new(&cfg);

    // `e.to_string()` on an SdkError is short and often useless (just "dispatch
    // failure" with no detail). We dig the whole error-source chain so the
    // frontend gets something we can actually debug.
    let fmt_err = |stage: &str, e: &dyn std::error::Error| {
        let mut out = format!("{}: {}", stage, e);
        let mut src = e.source();
        while let Some(s) = src {
            out.push_str(&format!("\n  caused by: {}", s));
            src = s.source();
        }
        out
    };

    let reg = oidc
        .register_client()
        .client_name("cloudorbit")
        .client_type("public")
        .scopes("sso:account:access")
        .send()
        .await
        .map_err(|e| fmt_err("register_client", &e))?;

    let da = oidc
        .start_device_authorization()
        .client_id(reg.client_id().unwrap_or_default())
        .client_secret(reg.client_secret().unwrap_or_default())
        .start_url(&start_url)
        .send()
        .await
        .map_err(|e| fmt_err("start_device_authorization", &e))?;

    let uri = da
        .verification_uri_complete()
        .unwrap_or_default()
        .to_string();

    // Open the default browser — uses the OS shell, so system certs are trusted
    let _ = open::that(&uri);

    Ok(SessionInfo {
        client_id:                 reg.client_id().unwrap_or_default().to_string(),
        client_secret:             reg.client_secret().unwrap_or_default().to_string(),
        device_code:               da.device_code().unwrap_or_default().to_string(),
        interval:                  da.interval(),
        verification_uri_complete: uri,
    })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PollResult {
    pub success: bool,
    pub pending: Option<bool>,
    pub error:   Option<String>,
}

/// Poll the OIDC token endpoint. Returns `success: true` once the user approves.
#[tauri::command]
pub async fn sso_login_poll(
    client_id:    String,
    client_secret: String,
    device_code:  String,
    start_url:    String,
    sso_region:   String,
) -> PollResult {
    let cfg = aws_http::config_for_region(&sso_region).await;

    let oidc = OidcClient::new(&cfg);

    match oidc
        .create_token()
        .client_id(&client_id)
        .client_secret(&client_secret)
        .grant_type("urn:ietf:params:oauth:grant-type:device_code")
        .device_code(&device_code)
        .send()
        .await
    {
        Ok(resp) => {
            write_cached_token(
                &start_url,
                &sso_region,
                resp.access_token().unwrap_or_default(),
                resp.expires_in() as i64,
            );
            PollResult { success: true, pending: None, error: None }
        }
        Err(e) => {
            // Pending detection — use the raw error debug repr because
            // `e.to_string()` for ServiceError doesn't always include the error
            // code string (depends on SDK version).
            let dbg = format!("{:?}", e);
            let is_pending = dbg.contains("AuthorizationPending") || dbg.contains("SlowDown");

            // Full source chain for everything else — previously "service
            // error" reached the UI with no detail. Now we include the SDK
            // error code, the HTTP body, and every `source()` level.
            let mut detail = format!("{}", e);
            let err_ref: &dyn std::error::Error = &e;
            let mut src = err_ref.source();
            while let Some(s) = src {
                detail.push_str(&format!("\n  caused by: {}", s));
                src = s.source();
            }
            if !is_pending {
                detail.push_str(&format!("\n  debug: {}", dbg));
            }

            PollResult {
                success: false,
                pending: Some(is_pending),
                error:   if is_pending { None } else { Some(detail) },
            }
        }
    }
}

// ── Unit tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── keyring_account ───────────────────────────────────────────────────────

    #[test]
    fn keyring_account_has_sso_prefix() {
        let account = keyring_account("https://example.awsapps.com/start");
        assert!(account.starts_with("sso-"));
    }

    #[test]
    fn keyring_account_total_length_is_24() {
        // "sso-" (4) + first 20 hex chars of SHA1
        let account = keyring_account("https://example.awsapps.com/start");
        assert_eq!(account.len(), 24);
    }

    #[test]
    fn keyring_account_is_deterministic() {
        let a1 = keyring_account("https://test.awsapps.com/start");
        let a2 = keyring_account("https://test.awsapps.com/start");
        assert_eq!(a1, a2);
    }

    #[test]
    fn keyring_account_differs_for_different_urls() {
        let a1 = keyring_account("https://company-a.awsapps.com/start");
        let a2 = keyring_account("https://company-b.awsapps.com/start");
        assert_ne!(a1, a2);
    }

    // ── cache_path ────────────────────────────────────────────────────────────

    #[test]
    fn cache_path_filename_is_sha1_dot_json() {
        let path = cache_path("https://example.awsapps.com/start");
        let filename = path.file_name().unwrap().to_str().unwrap();
        // 40 hex chars + ".json" = 45
        assert!(filename.ends_with(".json"));
        assert_eq!(filename.len(), 45);
    }

    #[test]
    fn cache_path_contains_aws_sso_cache_dir() {
        let path = cache_path("https://example.awsapps.com/start");
        let s = path.to_string_lossy();
        assert!(s.contains(".aws/sso/cache/"));
    }

    #[test]
    fn cache_path_is_deterministic() {
        let p1 = cache_path("https://same.awsapps.com/start");
        let p2 = cache_path("https://same.awsapps.com/start");
        assert_eq!(p1, p2);
    }

    #[test]
    fn cache_path_differs_for_different_urls() {
        let p1 = cache_path("https://org-a.awsapps.com/start");
        let p2 = cache_path("https://org-b.awsapps.com/start");
        assert_ne!(p1, p2);
    }
}

// ── Account / Role types ──────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub account_id:    String,
    pub account_name:  String,
    pub account_email: String,
    pub roles:         Vec<Role>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Role {
    pub role_name:  String,
    pub account_id: String,
}

/// List all accounts and their roles available under the given SSO token.
#[tauri::command]
pub async fn list_accounts(
    start_url:  String,
    sso_region: String,
) -> Result<Vec<Account>, String> {
    let access_token = read_cached_token(&start_url)
        .ok_or_else(|| "Not logged in — token expired or missing".to_string())?;

    let cfg = aws_http::config_for_region(&sso_region).await;

    let sso          = SsoClient::new(&cfg);
    let mut accounts = Vec::new();
    let mut next_token: Option<String> = None;

    loop {
        let mut req = sso.list_accounts().access_token(&access_token);
        if let Some(ref nt) = next_token {
            req = req.next_token(nt);
        }
        let resp = req.send().await.map_err(|e| e.to_string())?;

        for a in resp.account_list() {
            let account_id = a.account_id().unwrap_or_default().to_string();

            let mut roles: Vec<Role> = Vec::new();
            let mut role_next: Option<String> = None;
            loop {
                let mut rreq = sso
                    .list_account_roles()
                    .access_token(&access_token)
                    .account_id(&account_id);
                if let Some(ref rt) = role_next {
                    rreq = rreq.next_token(rt);
                }
                match rreq.send().await {
                    Ok(rr) => {
                        for r in rr.role_list() {
                            roles.push(Role {
                                role_name:  r.role_name().unwrap_or_default().to_string(),
                                account_id: account_id.clone(),
                            });
                        }
                        role_next = rr.next_token().map(|s| s.to_string());
                        if role_next.is_none() { break; }
                    }
                    Err(_) => break,
                }
            }

            accounts.push(Account {
                account_id,
                account_name:  a.account_name().unwrap_or_default().to_string(),
                account_email: a.email_address().unwrap_or_default().to_string(),
                roles,
            });
        }

        next_token = resp.next_token().map(|s| s.to_string());
        if next_token.is_none() { break; }
    }

    Ok(accounts)
}
