use std::collections::HashMap;
use std::fs;
use dirs::home_dir;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use aws_config::Region;
use aws_sdk_sso::Client as SsoClient;

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
) -> Result<Credentials, String> {
    let access_token = read_cached_token(&start_url)
        .ok_or_else(|| "Not logged in".to_string())?;

    let cfg = aws_config::defaults(aws_config::BehaviorVersion::latest())
        .region(Region::new(sso_region))
        .no_credentials()
        .load()
        .await;

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
    write_credentials(&profile_name, &key_id, &secret, &token)
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

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            let name = trimmed[1..trimmed.len() - 1].to_string();
            cur = Some(name.clone());
            if !sections.contains_key(&name) {
                order.push(name.clone());
                sections.insert(name, Vec::new());
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
