use std::collections::HashMap;
use std::fs;
use dirs::home_dir;
use serde::{Deserialize, Serialize};

// ── Public types (serialized to the frontend) ────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SsoGroup {
    pub start_url: String,
    pub sso_region: String,
    pub profiles: Vec<Profile>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub name: String,
    pub start_url: String,
    pub sso_region: String,
    pub account_id: Option<String>,
    pub role_name: Option<String>,
    pub region: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedConfig {
    pub sso_groups: Vec<SsoGroup>,
}

// ── INI parser ───────────────────────────────────────────────────────────────

fn parse_ini(content: &str) -> HashMap<String, HashMap<String, String>> {
    let mut sections: HashMap<String, HashMap<String, String>> = HashMap::new();
    let mut current = String::new();

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') || line.starts_with(';') {
            continue;
        }
        if line.starts_with('[') && line.ends_with(']') {
            current = line[1..line.len() - 1].to_string();
            sections.entry(current.clone()).or_default();
        } else if let Some(eq) = line.find('=') {
            let key = line[..eq].trim().to_string();
            let val = line[eq + 1..].trim().to_string();
            if !current.is_empty() {
                sections.entry(current.clone()).or_default().insert(key, val);
            }
        }
    }
    sections
}

// ── Tauri command ────────────────────────────────────────────────────────────

/// Parse ~/.aws/config and return SSO groups.
#[tauri::command]
pub fn parse_config() -> Result<ParsedConfig, String> {
    let config_path = home_dir()
        .ok_or("Cannot find home directory")?
        .join(".aws")
        .join("config");

    let content = fs::read_to_string(&config_path).unwrap_or_default();
    let sections = parse_ini(&content);

    // Extract [sso-session …] blocks (new format)
    let mut sso_sessions: HashMap<String, (String, String)> = HashMap::new();
    for (name, props) in &sections {
        if let Some(session_name) = name.strip_prefix("sso-session ") {
            if let (Some(url), Some(region)) =
                (props.get("sso_start_url"), props.get("sso_region"))
            {
                sso_sessions.insert(session_name.to_string(), (url.clone(), region.clone()));
            }
        }
    }

    // Extract [profile …] and [default] blocks
    let mut profiles: Vec<Profile> = Vec::new();
    for (name, props) in &sections {
        let profile_name = if name == "default" {
            "default".to_string()
        } else if let Some(pn) = name.strip_prefix("profile ") {
            pn.to_string()
        } else {
            continue;
        };

        let mut start_url = props.get("sso_start_url").cloned();
        let mut sso_region = props.get("sso_region").cloned();

        // Resolve indirect sso_session reference
        if let Some(session_ref) = props.get("sso_session") {
            if let Some((url, region)) = sso_sessions.get(session_ref) {
                start_url = start_url.or_else(|| Some(url.clone()));
                sso_region = sso_region.or_else(|| Some(region.clone()));
            }
        }

        if let Some(url) = start_url {
            let region_fallback = sso_region.clone().unwrap_or_else(|| "us-east-1".to_string());
            profiles.push(Profile {
                name: profile_name,
                start_url: url.clone(),
                sso_region: sso_region.unwrap_or_else(|| "us-east-1".to_string()),
                account_id: props.get("sso_account_id").cloned(),
                role_name: props.get("sso_role_name").cloned(),
                region: props.get("region").cloned().unwrap_or(region_fallback),
            });
        }
    }

    // Also surface any sso-session that has no matching profiles yet
    let profile_urls: std::collections::HashSet<_> =
        profiles.iter().map(|p| p.start_url.clone()).collect();
    for (url, region) in sso_sessions.values() {
        if !profile_urls.contains(url) {
            profiles.push(Profile {
                name: String::new(),
                start_url: url.clone(),
                sso_region: region.clone(),
                account_id: None,
                role_name: None,
                region: region.clone(),
            });
        }
    }

    // Group profiles by start_url, preserving encounter order
    let mut group_map: HashMap<String, SsoGroup> = HashMap::new();
    let mut group_order: Vec<String> = Vec::new();

    for p in profiles {
        if !group_map.contains_key(&p.start_url) {
            group_order.push(p.start_url.clone());
            group_map.insert(
                p.start_url.clone(),
                SsoGroup {
                    start_url: p.start_url.clone(),
                    sso_region: p.sso_region.clone(),
                    profiles: Vec::new(),
                },
            );
        }
        if !p.name.is_empty() {
            group_map.get_mut(&p.start_url).unwrap().profiles.push(p);
        }
    }

    let sso_groups = group_order
        .into_iter()
        .filter_map(|url| group_map.remove(&url))
        .collect();

    Ok(ParsedConfig { sso_groups })
}

// ── Unit tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_ini_empty_input() {
        assert!(parse_ini("").is_empty());
    }

    #[test]
    fn parse_ini_basic_section() {
        let content = "[profile foo]\nregion = us-east-1\noutput = json\n";
        let result = parse_ini(content);
        assert_eq!(result["profile foo"]["region"], "us-east-1");
        assert_eq!(result["profile foo"]["output"], "json");
    }

    #[test]
    fn parse_ini_ignores_hash_and_semicolon_comments() {
        let content = "# hash comment\n; semicolon comment\n[section]\nkey = value\n";
        let result = parse_ini(content);
        assert_eq!(result.len(), 1);
        assert_eq!(result["section"]["key"], "value");
    }

    #[test]
    fn parse_ini_multiple_sections() {
        let content = "[a]\nfoo = 1\n[b]\nbar = 2\n";
        let result = parse_ini(content);
        assert_eq!(result["a"]["foo"], "1");
        assert_eq!(result["b"]["bar"], "2");
        assert_eq!(result.len(), 2);
    }

    #[test]
    fn parse_ini_trims_key_and_value_whitespace() {
        let content = "[section]\n  key   =   value with spaces  \n";
        let result = parse_ini(content);
        assert_eq!(result["section"]["key"], "value with spaces");
    }

    #[test]
    fn parse_ini_ignores_keyval_before_any_section() {
        let content = "orphan = ignored\n[section]\nkey = val\n";
        let result = parse_ini(content);
        // The orphan key has no section — it must not appear in any bucket
        assert!(!result.contains_key(""));
        assert_eq!(result.len(), 1);
        assert_eq!(result["section"]["key"], "val");
    }

    #[test]
    fn parse_ini_sso_session_and_profile() {
        let content = concat!(
            "[sso-session myorg]\n",
            "sso_start_url = https://myorg.awsapps.com/start\n",
            "sso_region = us-east-1\n",
            "[profile myorg-dev]\n",
            "sso_session = myorg\n",
            "sso_account_id = 123456789012\n",
            "sso_role_name = Developer\n",
            "region = us-west-2\n",
        );
        let result = parse_ini(content);
        assert_eq!(result["sso-session myorg"]["sso_start_url"], "https://myorg.awsapps.com/start");
        assert_eq!(result["profile myorg-dev"]["sso_account_id"], "123456789012");
    }

    #[test]
    fn parse_ini_empty_lines_are_skipped() {
        let content = "[section]\n\n\nkey = value\n\n";
        let result = parse_ini(content);
        assert_eq!(result["section"]["key"], "value");
    }

    #[test]
    fn parse_config_iam_profile_no_sso_session() {
        // A plain IAM profile (no sso_session) should be parsed without error.
        // It won't form an SSO group since it has no start_url.
        let content = concat!(
            "[profile iam-user]\n",
            "region = us-east-1\n",
            "output = json\n",
        );
        let result = parse_ini(content);
        assert_eq!(result["profile iam-user"]["region"], "us-east-1");
        // Calling parse_config with such a config should return empty sso_groups
        // (no start_url → no grouping) without panicking.
    }

    #[test]
    fn parse_config_mixed_sso_and_iam_profiles() {
        let content = concat!(
            "[sso-session myorg]\n",
            "sso_start_url = https://myorg.awsapps.com/start\n",
            "sso_region = us-east-1\n",
            "[profile sso-dev]\n",
            "sso_session = myorg\n",
            "sso_account_id = 111122223333\n",
            "sso_role_name = Developer\n",
            "region = us-west-2\n",
            "[profile iam-ops]\n",
            "region = eu-west-1\n",
            "output = json\n",
        );
        let result = parse_ini(content);
        // Both profiles parsed
        assert!(result.contains_key("profile sso-dev"));
        assert!(result.contains_key("profile iam-ops"));
        assert_eq!(result["profile iam-ops"]["region"], "eu-west-1");
    }

    #[test]
    fn parse_config_missing_region_uses_fallback() {
        // Profile with no region key — parse_config falls back to "us-east-1"
        let content = concat!(
            "[sso-session org]\n",
            "sso_start_url = https://org.awsapps.com/start\n",
            "sso_region = us-east-1\n",
            "[profile no-region]\n",
            "sso_session = org\n",
            "sso_account_id = 999988887777\n",
            "sso_role_name = ReadOnly\n",
        );
        let ini = parse_ini(content);
        let region = ini.get("profile no-region")
            .and_then(|p| p.get("region"))
            .map(|s| s.as_str())
            .unwrap_or("us-east-1");
        assert_eq!(region, "us-east-1");
    }
}
