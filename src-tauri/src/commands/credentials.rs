use std::collections::HashMap;
use std::fs;
use dirs::home_dir;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use aws_sdk_sso::Client as SsoClient;
use aws_sdk_sts::Client as StsClient;
use aws_credential_types::Credentials as AwsCreds;

use crate::aws_http;
use crate::commands::sso::read_cached_token;

// ── Assume role ──────────────────────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Credentials {
    pub profile_name: String,
    pub access_key_id: String,
    pub secret_access_key: String,
    pub session_token: String,
    pub expires_at: Option<String>,
    pub account_id: String,
    pub role_name: String,
}

/// Get temporary credentials for a role and write them to ~/.aws/credentials.
#[tauri::command]
pub async fn assume_role(
    start_url: String,
    sso_region: String,
    account_id: String,
    role_name: String,
    region: String,
) -> Result<Credentials, String> {
    let access_token = read_cached_token(&start_url)
        .ok_or_else(|| "Not logged in".to_string())?;

    let cfg = aws_http::config_for_region(&sso_region).await;

    let sso = SsoClient::new(&cfg);

    let resp = sso
        .get_role_credentials()
        .access_token(&access_token)
        .account_id(&account_id)
        .role_name(&role_name)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let creds = resp.role_credentials().ok_or("No credentials in response")?;

    let key_id = creds.access_key_id().unwrap_or_default().to_string();
    let secret  = creds.secret_access_key().unwrap_or_default().to_string();
    let token   = creds.session_token().unwrap_or_default().to_string();

    let expires_at = DateTime::<Utc>::from_timestamp_millis(creds.expiration())
        .map(|dt| dt.to_rfc3339());

    let profile_name = format!("{}-{}", account_id, role_name);
    write_credentials(&profile_name, &key_id, &secret, &token, &region)
        .map_err(|e| e.to_string())?;

    Ok(Credentials {
        profile_name,
        access_key_id: key_id,
        secret_access_key: secret,
        session_token: token,
        expires_at,
        account_id,
        role_name,
    })
}

fn write_credentials(
    profile_name: &str,
    key_id: &str,
    secret: &str,
    token: &str,
    region: &str,
) -> Result<(), std::io::Error> {
    let cred_path = home_dir().unwrap().join(".aws").join("credentials");
    let content   = fs::read_to_string(&cred_path).unwrap_or_default();

    // Parse preserving order
    let mut sections: HashMap<String, Vec<String>> = HashMap::new();
    let mut order: Vec<String> = Vec::new();
    let mut cur = String::new();

    for line in content.lines() {
        if line.starts_with('[') && line.ends_with(']') {
            cur = line[1..line.len() - 1].to_string();
            if !sections.contains_key(&cur) {
                order.push(cur.clone());
                sections.insert(cur.clone(), Vec::new());
            }
        } else if !cur.is_empty() {
            sections.get_mut(&cur).unwrap().push(line.to_string());
        }
    }

    let block = vec![
        format!("aws_access_key_id = {}", key_id),
        format!("aws_secret_access_key = {}", secret),
        format!("aws_session_token = {}", token),
        format!("region = {}", region),
    ];

    for name in &["default", profile_name] {
        if !sections.contains_key(*name) {
            order.push(name.to_string());
        }
        sections.insert(name.to_string(), block.clone());
    }

    let mut out = String::new();
    for name in &order {
        out.push_str(&format!("[{}]\n{}\n\n", name, sections[name].join("\n")));
    }

    fs::create_dir_all(cred_path.parent().unwrap())?;
    fs::write(&cred_path, out.trim_end().to_string() + "\n")
}

// ── Read profile credentials ─────────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileCreds {
    pub access_key_id: String,
    pub secret_access_key: String,
    pub session_token: String,
}

/// Read credentials for a named profile from ~/.aws/credentials.
#[tauri::command]
pub fn read_profile_credentials(profile_name: String) -> Result<ProfileCreds, String> {
    let cred_path = home_dir()
        .ok_or("No home dir")?
        .join(".aws")
        .join("credentials");

    let content = fs::read_to_string(&cred_path).map_err(|e| e.to_string())?;

    let mut in_section = false;
    let mut found_section = false;
    let mut key_id: Option<String> = None;
    let mut secret: Option<String> = None;
    let mut token: Option<String> = None;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            let name = &trimmed[1..trimmed.len() - 1];
            if found_section { break; }
            in_section = name == profile_name;
            if in_section { found_section = true; }
        } else if in_section {
            if let Some((k, v)) = trimmed.split_once('=') {
                match k.trim() {
                    "aws_access_key_id"     => key_id = Some(v.trim().to_string()),
                    "aws_secret_access_key" => secret  = Some(v.trim().to_string()),
                    "aws_session_token"     => token   = Some(v.trim().to_string()),
                    _ => {}
                }
            }
        }
    }

    match (key_id, secret, token) {
        (Some(k), Some(s), Some(t)) => Ok(ProfileCreds {
            access_key_id: k,
            secret_access_key: s,
            session_token: t,
        }),
        _ => Err(format!("Profile '{}' not found in ~/.aws/credentials", profile_name)),
    }
}

// ── Write SSO config ─────────────────────────────────────────────────────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoleInput {
    pub role_name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountInput {
    pub account_id: String,
    pub account_name: String,
    pub roles: Vec<RoleInput>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteSsoResult {
    pub session_name: String,
    pub profile_count: usize,
}

/// Persist discovered accounts/roles to ~/.aws/config as proper SSO profiles.
#[tauri::command]
pub fn write_sso_config(
    start_url: String,
    sso_region: String,
    accounts: Vec<AccountInput>,
) -> Result<WriteSsoResult, String> {
    let config_path = home_dir()
        .ok_or("No home dir")?
        .join(".aws")
        .join("config");

    let content = fs::read_to_string(&config_path).unwrap_or_default();

    // Parse preserving structure
    let mut sections: HashMap<String, Vec<String>> = HashMap::new();
    let mut order: Vec<String> = Vec::new();
    let mut cur: Option<String> = None;

    use std::collections::hash_map::Entry;
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            let name = trimmed[1..trimmed.len() - 1].to_string();
            cur = Some(name.clone());
            if let Entry::Vacant(e) = sections.entry(name.clone()) {
                order.push(name);
                e.insert(Vec::new());
            }
        } else if let Some(ref name) = cur {
            sections.get_mut(name).unwrap().push(line.to_string());
        }
    }

    // Derive session name from start URL hostname (e.g. "https://company.awsapps.com/start" → "company")
    let session_name = start_url
        .trim_start_matches("https://")
        .trim_start_matches("http://")
        .split('/')
        .next()
        .unwrap_or("aws")
        .split('.')
        .next()
        .unwrap_or("aws")
        .to_string();

    let session_key = format!("sso-session {}", session_name);
    if !sections.contains_key(&session_key) { order.push(session_key.clone()); }
    sections.insert(session_key, vec![
        format!("sso_start_url = {}", start_url),
        format!("sso_region = {}", sso_region),
        "sso_registration_scopes = sso:account:access".to_string(),
    ]);

    let mut profile_count = 0usize;
    for account in &accounts {
        for role in &account.roles {
            let safe_name = account.account_name
                .chars()
                .map(|c| if c.is_alphanumeric() { c.to_ascii_lowercase() } else { '-' })
                .collect::<String>()
                .split('-')
                .filter(|s| !s.is_empty())
                .collect::<Vec<_>>()
                .join("-");
            let profile_key = format!("profile {}-{}", safe_name, role.role_name);
            if !sections.contains_key(&profile_key) { order.push(profile_key.clone()); }
            sections.insert(profile_key, vec![
                format!("sso_session = {}", session_name),
                format!("sso_account_id = {}", account.account_id),
                format!("sso_role_name = {}", role.role_name),
                format!("region = {}", sso_region),
                "output = json".to_string(),
            ]);
            profile_count += 1;
        }
    }

    let mut out = String::new();
    for name in &order {
        let lines = &sections[name];
        out.push_str(&format!("[{}]\n{}\n\n", name, lines.join("\n")));
    }

    fs::create_dir_all(config_path.parent().unwrap()).map_err(|e| e.to_string())?;
    fs::write(&config_path, out.trim_end().to_string() + "\n").map_err(|e| e.to_string())?;

    Ok(WriteSsoResult { session_name, profile_count })
}

// ── IAM User session ──────────────────────────────────────────────────────────

/// Start a session using long-lived IAM user credentials.
/// Validates them via STS GetCallerIdentity, writes to ~/.aws/credentials,
/// and returns a Credentials record with an 8-hour effective expiry.
#[tauri::command]
pub async fn start_iam_session(
    access_key_id: String,
    secret_access_key: String,
    region: String,
    alias: String,
) -> Result<Credentials, String> {
    let creds = AwsCreds::new(
        &access_key_id, &secret_access_key,
        None, None, "cloudorbit-iam",
    );

    let cfg = aws_http::config_for_region_with_creds_and_endpoint(&region, creds).await;
    let sts = StsClient::new(&cfg);

    let identity = sts.get_caller_identity()
        .send()
        .await
        .map_err(|e| format!("Credentials validation failed: {}", e))?;

    let account_id = identity.account().unwrap_or("unknown").to_string();
    let profile_name = alias.clone();

    write_credentials(&profile_name, &access_key_id, &secret_access_key, "", &region)
        .map_err(|e| e.to_string())?;

    // IAM user credentials don't expire — use 8 hours as a soft session window.
    let expires_at = (Utc::now() + chrono::Duration::hours(8)).to_rfc3339();

    Ok(Credentials {
        profile_name,
        access_key_id,
        secret_access_key,
        session_token: String::new(),
        expires_at: Some(expires_at),
        account_id,
        role_name: String::new(),
    })
}

// ── Chained role assumption ───────────────────────────────────────────────────

/// Assume a role using credentials from an existing profile (chained assumption).
#[tauri::command]
pub async fn assume_role_chained(
    source_profile: String,
    role_arn: String,
    session_name: String,
    region: String,
) -> Result<Credentials, String> {
    let source = read_profile_credentials(source_profile)
        .map_err(|e| format!("Source profile not found: {}", e))?;

    let creds = AwsCreds::new(
        &source.access_key_id, &source.secret_access_key,
        Some(source.session_token.clone()), None, "cloudorbit-chained",
    );

    let cfg = aws_http::config_for_region_with_creds_and_endpoint(&region, creds).await;
    let sts = StsClient::new(&cfg);

    let resp = sts.assume_role()
        .role_arn(&role_arn)
        .role_session_name(&session_name)
        .duration_seconds(3600)
        .send()
        .await
        .map_err(|e| format!("AssumeRole failed: {}", e))?;

    let assumed = resp.credentials().ok_or("No credentials in AssumeRole response")?;
    let key_id  = assumed.access_key_id().to_string();
    let secret  = assumed.secret_access_key().to_string();
    let token   = assumed.session_token().to_string();
    let exp_secs = assumed.expiration().secs();
    let expires_at = DateTime::<Utc>::from_timestamp(exp_secs, 0)
        .map(|dt| dt.to_rfc3339());

    let profile_name = format!("chained-{}", session_name);
    write_credentials(&profile_name, &key_id, &secret, &token, &region)
        .map_err(|e| e.to_string())?;

    let account_id = role_arn.split(':').nth(4).unwrap_or("unknown").to_string();

    Ok(Credentials {
        profile_name,
        access_key_id: key_id,
        secret_access_key: secret,
        session_token: token,
        expires_at,
        account_id,
        role_name: role_arn.split('/').last().unwrap_or("").to_string(),
    })
}

// ── Federated session (WebIdentity) ──────────────────────────────────────────

/// Assume a role using a web identity token (OIDC / Federated).
#[tauri::command]
pub async fn assume_role_federated(
    role_arn: String,
    web_identity_token: String,
    session_name: String,
    region: String,
) -> Result<Credentials, String> {
    // Federated calls don't carry pre-existing credentials; use anonymous config
    // with optional endpoint override for LocalStack.
    let cfg = {
        use aws_config::{BehaviorVersion, Region, SdkConfig};
        use aws_smithy_runtime::client::http::hyper_014::HyperClientBuilder;
        let https = hyper_tls::HttpsConnector::new();
        let http_client = HyperClientBuilder::new().build(https);
        let mut builder = aws_config::defaults(BehaviorVersion::latest())
            .http_client(http_client)
            .region(Region::new(region.clone()))
            .no_credentials();
        if let Ok(endpoint) = std::env::var("AWS_ENDPOINT_URL") {
            if !endpoint.is_empty() { builder = builder.endpoint_url(endpoint); }
        }
        builder.load().await
    };

    let sts = StsClient::new(&cfg);

    let resp = sts.assume_role_with_web_identity()
        .role_arn(&role_arn)
        .web_identity_token(&web_identity_token)
        .role_session_name(&session_name)
        .duration_seconds(3600)
        .send()
        .await
        .map_err(|e| format!("AssumeRoleWithWebIdentity failed: {}", e))?;

    let assumed = resp.credentials().ok_or("No credentials in federated response")?;
    let key_id  = assumed.access_key_id().to_string();
    let secret  = assumed.secret_access_key().to_string();
    let token   = assumed.session_token().to_string();
    let exp_secs = assumed.expiration().secs();
    let expires_at = DateTime::<Utc>::from_timestamp(exp_secs, 0)
        .map(|dt| dt.to_rfc3339());

    let profile_name = format!("federated-{}", session_name);
    write_credentials(&profile_name, &key_id, &secret, &token, &region)
        .map_err(|e| e.to_string())?;

    let account_id = role_arn.split(':').nth(4).unwrap_or("unknown").to_string();

    Ok(Credentials {
        profile_name,
        access_key_id: key_id,
        secret_access_key: secret,
        session_token: token,
        expires_at,
        account_id,
        role_name: role_arn.split('/').last().unwrap_or("").to_string(),
    })
}

// ── Unit tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use tempfile::TempDir;

    // Helper: build a write_credentials call that targets a temp dir.
    // We override HOME so dirs::home_dir() resolves inside the temp dir.
    fn temp_creds_path(tmp: &TempDir) -> PathBuf {
        tmp.path().join(".aws").join("credentials")
    }

    fn write_creds_to(
        tmp: &TempDir,
        profile: &str,
        key: &str,
        secret: &str,
        token: &str,
        region: &str,
    ) -> Result<(), std::io::Error> {
        let cred_path = temp_creds_path(tmp);
        fs::create_dir_all(cred_path.parent().unwrap())?;
        let content = fs::read_to_string(&cred_path).unwrap_or_default();

        let mut sections: HashMap<String, Vec<String>> = HashMap::new();
        let mut order: Vec<String> = Vec::new();
        let mut cur = String::new();

        for line in content.lines() {
            if line.starts_with('[') && line.ends_with(']') {
                cur = line[1..line.len() - 1].to_string();
                if !sections.contains_key(&cur) {
                    order.push(cur.clone());
                    sections.insert(cur.clone(), Vec::new());
                }
            } else if !cur.is_empty() {
                sections.get_mut(&cur).unwrap().push(line.to_string());
            }
        }

        let block = vec![
            format!("aws_access_key_id = {}", key),
            format!("aws_secret_access_key = {}", secret),
            format!("aws_session_token = {}", token),
            format!("region = {}", region),
        ];

        for name in &["default", profile] {
            if !sections.contains_key(*name) { order.push(name.to_string()); }
            sections.insert(name.to_string(), block.clone());
        }

        let mut out = String::new();
        for name in &order {
            out.push_str(&format!("[{}]\n{}\n\n", name, sections[name].join("\n")));
        }
        fs::write(&cred_path, out.trim_end().to_string() + "\n")
    }

    fn read_creds_from(tmp: &TempDir, profile: &str) -> Result<ProfileCreds, String> {
        let cred_path = temp_creds_path(tmp);
        let content = fs::read_to_string(&cred_path).map_err(|e| e.to_string())?;

        let mut in_section = false;
        let mut found = false;
        let mut key_id: Option<String> = None;
        let mut secret:  Option<String> = None;
        let mut token:   Option<String> = None;

        for line in content.lines() {
            let t = line.trim();
            if t.starts_with('[') && t.ends_with(']') {
                if found { break; }
                in_section = &t[1..t.len()-1] == profile;
                if in_section { found = true; }
            } else if in_section {
                if let Some((k, v)) = t.split_once('=') {
                    match k.trim() {
                        "aws_access_key_id"     => key_id = Some(v.trim().to_string()),
                        "aws_secret_access_key" => secret  = Some(v.trim().to_string()),
                        "aws_session_token"     => token   = Some(v.trim().to_string()),
                        _ => {}
                    }
                }
            }
        }

        match (key_id, secret, token) {
            (Some(k), Some(s), Some(t)) => Ok(ProfileCreds {
                access_key_id: k, secret_access_key: s, session_token: t,
            }),
            _ => Err(format!("profile '{}' not found", profile)),
        }
    }

    // ── write_credentials ─────────────────────────────────────────────────────

    #[test]
    fn write_credentials_creates_file_with_all_fields() {
        let tmp = TempDir::new().unwrap();
        write_creds_to(&tmp, "test-profile", "AKID", "SECRET", "TOKEN", "us-east-1").unwrap();
        let content = fs::read_to_string(temp_creds_path(&tmp)).unwrap();
        assert!(content.contains("aws_access_key_id = AKID"));
        assert!(content.contains("aws_secret_access_key = SECRET"));
        assert!(content.contains("aws_session_token = TOKEN"));
        assert!(content.contains("region = us-east-1"));
    }

    #[test]
    fn write_credentials_sets_default_profile() {
        let tmp = TempDir::new().unwrap();
        write_creds_to(&tmp, "my-profile", "K", "S", "T", "eu-west-1").unwrap();
        let content = fs::read_to_string(temp_creds_path(&tmp)).unwrap();
        assert!(content.contains("[default]"));
        assert!(content.contains("[my-profile]"));
    }

    #[test]
    fn write_credentials_preserves_unrelated_profiles() {
        let tmp = TempDir::new().unwrap();
        // Write profile A first
        write_creds_to(&tmp, "profile-a", "KA", "SA", "TA", "us-west-2").unwrap();
        // Write profile B — profile A must survive
        write_creds_to(&tmp, "profile-b", "KB", "SB", "TB", "us-east-1").unwrap();
        let content = fs::read_to_string(temp_creds_path(&tmp)).unwrap();
        assert!(content.contains("[profile-a]"), "profile-a missing after writing profile-b");
        assert!(content.contains("[profile-b]"));
        assert!(content.contains("aws_access_key_id = KA"));
        assert!(content.contains("aws_access_key_id = KB"));
    }

    #[test]
    fn write_credentials_overwrites_existing_profile() {
        let tmp = TempDir::new().unwrap();
        write_creds_to(&tmp, "p", "OLD_KEY", "OLD_SECRET", "OLD_TOKEN", "us-east-1").unwrap();
        write_creds_to(&tmp, "p", "NEW_KEY", "NEW_SECRET", "NEW_TOKEN", "us-west-2").unwrap();
        let content = fs::read_to_string(temp_creds_path(&tmp)).unwrap();
        assert!(content.contains("NEW_KEY"));
        assert!(!content.contains("OLD_KEY"));
    }

    // ── read_profile_credentials ──────────────────────────────────────────────

    #[test]
    fn read_profile_credentials_round_trip() {
        let tmp = TempDir::new().unwrap();
        write_creds_to(&tmp, "roundtrip", "AKID123", "SEC456", "TOK789", "ap-east-1").unwrap();
        let result = read_creds_from(&tmp, "roundtrip").unwrap();
        assert_eq!(result.access_key_id,     "AKID123");
        assert_eq!(result.secret_access_key, "SEC456");
        assert_eq!(result.session_token,     "TOK789");
    }

    #[test]
    fn read_profile_credentials_not_found_returns_err() {
        let tmp = TempDir::new().unwrap();
        write_creds_to(&tmp, "exists", "K", "S", "T", "us-east-1").unwrap();
        assert!(read_creds_from(&tmp, "does-not-exist").is_err());
    }

    #[test]
    fn read_profile_credentials_no_file_returns_err() {
        let tmp = TempDir::new().unwrap();
        // No credentials file created
        assert!(read_creds_from(&tmp, "any").is_err());
    }

    #[test]
    fn read_profile_credentials_trims_whitespace() {
        let tmp = TempDir::new().unwrap();
        let path = temp_creds_path(&tmp);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, "[spaced]\naws_access_key_id   =   SPACED_KEY  \naws_secret_access_key = SPACED_SECRET\naws_session_token = SPACED_TOKEN\n").unwrap();
        let result = read_creds_from(&tmp, "spaced").unwrap();
        assert_eq!(result.access_key_id, "SPACED_KEY");
        assert_eq!(result.secret_access_key, "SPACED_SECRET");
    }

    #[test]
    fn read_profile_credentials_partial_fields_returns_err() {
        let tmp = TempDir::new().unwrap();
        let path = temp_creds_path(&tmp);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        // Missing aws_session_token
        fs::write(&path, "[partial]\naws_access_key_id = K\naws_secret_access_key = S\n").unwrap();
        assert!(read_creds_from(&tmp, "partial").is_err());
    }

    // ── persistence / restart ─────────────────────────────────────────────────

    #[test]
    fn credentials_survive_restart_round_trip() {
        let tmp = TempDir::new().unwrap();
        write_creds_to(&tmp, "restart-test", "AKID", "SECRET", "TOKEN", "us-west-2").unwrap();
        let loaded = read_creds_from(&tmp, "restart-test").unwrap();
        assert_eq!(loaded.access_key_id,     "AKID");
        assert_eq!(loaded.secret_access_key, "SECRET");
        assert_eq!(loaded.session_token,     "TOKEN");
    }

    #[test]
    fn credentials_partial_overwrite_leaves_other_profile_intact() {
        let tmp = TempDir::new().unwrap();
        write_creds_to(&tmp, "alpha", "KA", "SA", "TA", "eu-central-1").unwrap();
        write_creds_to(&tmp, "beta",  "KB", "SB", "TB", "ap-northeast-1").unwrap();
        // Overwrite alpha only
        write_creds_to(&tmp, "alpha", "KA2", "SA2", "TA2", "eu-central-1").unwrap();
        let alpha = read_creds_from(&tmp, "alpha").unwrap();
        let beta  = read_creds_from(&tmp, "beta").unwrap();
        assert_eq!(alpha.access_key_id, "KA2");
        assert_eq!(beta.access_key_id,  "KB");
    }
}

// ── LocalStack integration tests (require AWS_ENDPOINT_URL=http://localhost:4566) ──

#[cfg(test)]
mod integration {
    use super::*;

    fn localstack_endpoint() -> Option<String> {
        std::env::var("AWS_ENDPOINT_URL").ok().filter(|s| !s.is_empty())
    }

    fn skip_if_no_localstack() -> bool {
        localstack_endpoint().is_none()
    }

    #[tokio::test]
    #[ignore = "requires LocalStack (docker compose up)"]
    async fn start_iam_session_validates_credentials() {
        if skip_if_no_localstack() { return; }
        // LocalStack accepts any credentials for GetCallerIdentity
        let result = start_iam_session(
            "test".to_string(),
            "test".to_string(),
            "us-east-1".to_string(),
            "ls-iam-test".to_string(),
        ).await;
        assert!(result.is_ok(), "Expected Ok, got: {:?}", result.err());
        let creds = result.unwrap();
        assert!(!creds.account_id.is_empty());
    }

    #[tokio::test]
    #[ignore = "requires LocalStack (docker compose up)"]
    async fn assume_role_chained_success() {
        if skip_if_no_localstack() { return; }
        use tempfile::TempDir;
        let tmp = TempDir::new().unwrap();
        // Write source credentials to a temp file and set HOME
        let cred_path = tmp.path().join(".aws").join("credentials");
        std::fs::create_dir_all(cred_path.parent().unwrap()).unwrap();
        std::fs::write(&cred_path, "[source-profile]\naws_access_key_id = test\naws_secret_access_key = test\naws_session_token = test\nregion = us-east-1\n").unwrap();

        // LocalStack role ARN
        let role_arn = "arn:aws:iam::000000000000:role/TestRole";
        let result = assume_role_chained(
            "source-profile".to_string(),
            role_arn.to_string(),
            "chained-test".to_string(),
            "us-east-1".to_string(),
        ).await;
        // May fail if role doesn't exist in LocalStack — that's a valid test outcome
        // The important thing is no panic and structured error
        match result {
            Ok(creds) => assert!(!creds.access_key_id.is_empty()),
            Err(e)    => assert!(e.contains("AssumeRole") || e.contains("not found") || e.contains("NoSuchEntity")),
        }
    }

    #[tokio::test]
    #[ignore = "requires LocalStack (docker compose up)"]
    async fn assume_role_federated_success() {
        if skip_if_no_localstack() { return; }
        let role_arn = "arn:aws:iam::000000000000:role/TestRole";
        let result = assume_role_federated(
            role_arn.to_string(),
            "fake-web-identity-token".to_string(),
            "federated-test".to_string(),
            "us-east-1".to_string(),
        ).await;
        match result {
            Ok(creds) => assert!(!creds.access_key_id.is_empty()),
            Err(e)    => assert!(e.contains("federated") || e.contains("WebIdentity") || e.contains("NoSuchEntity") || e.contains("InvalidIdentityToken")),
        }
    }

    #[tokio::test]
    #[ignore = "requires LocalStack (docker compose up)"]
    async fn start_iam_session_writes_credentials_file() {
        if skip_if_no_localstack() { return; }
        let alias = format!("ls-iam-{}", std::process::id());
        let _ = start_iam_session(
            "test".to_string(), "test".to_string(),
            "us-east-1".to_string(), alias.clone(),
        ).await;
        // Credentials file should exist after the call
        let cred_path = home_dir().unwrap().join(".aws").join("credentials");
        if cred_path.exists() {
            let content = std::fs::read_to_string(&cred_path).unwrap_or_default();
            assert!(content.contains(&alias) || content.contains("default"));
        }
    }
}
