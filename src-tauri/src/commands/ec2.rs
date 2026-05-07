use std::process::Command;
use serde::{Deserialize, Serialize};
use aws_config::Region;
use aws_credential_types::Credentials as AwsCreds;
use aws_sdk_ec2::Client as Ec2Client;
use aws_sdk_ec2::types::Filter;

// ── Types ────────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Ec2Instance {
    pub instance_id:   String,
    pub name:          String,
    pub instance_type: String,
    pub state:         String,
    pub private_ip:    String,
    pub public_ip:     Option<String>,
    pub platform:      String,     // "Linux" | "Windows"
    pub region:        String,
    pub az:            String,
    pub image_id:      String,
}

// ── Commands ─────────────────────────────────────────────────────────────────

/// List running and stopped EC2 instances in the given region.
/// Excludes terminated instances (they're gone anyway).
#[tauri::command]
pub async fn list_ec2_instances(
    region: String,
    access_key_id: String,
    secret_access_key: String,
    session_token: String,
) -> Result<Vec<Ec2Instance>, String> {
    let creds = AwsCreds::new(
        access_key_id, secret_access_key, Some(session_token), None, "cloudorbit",
    );
    let cfg = aws_config::defaults(aws_config::BehaviorVersion::latest())
        .region(Region::new(region.clone()))
        .credentials_provider(creds)
        .load()
        .await;

    let ec2 = Ec2Client::new(&cfg);

    // Exclude terminated/shutting-down instances
    let state_filter = Filter::builder()
        .name("instance-state-name")
        .values("running")
        .values("stopped")
        .values("stopping")
        .values("pending")
        .build();

    let mut instances = Vec::new();
    let mut next_token: Option<String> = None;

    loop {
        let mut req = ec2.describe_instances().filters(state_filter.clone());
        if let Some(ref t) = next_token {
            req = req.next_token(t);
        }
        let resp = req.send().await.map_err(|e| e.to_string())?;

        for reservation in resp.reservations() {
            for inst in reservation.instances() {
                let name = inst
                    .tags()
                    .iter()
                    .find(|t| t.key().map(|k| k == "Name").unwrap_or(false))
                    .and_then(|t| t.value())
                    .unwrap_or("")
                    .to_string();

                let state = inst
                    .state()
                    .and_then(|s| s.name())
                    .map(|n| n.as_str().to_string())
                    .unwrap_or_else(|| "unknown".to_string());

                let platform = if inst.platform().is_some() {
                    "Windows"
                } else {
                    "Linux"
                }
                .to_string();

                instances.push(Ec2Instance {
                    instance_id:   inst.instance_id().unwrap_or_default().to_string(),
                    name,
                    instance_type: inst
                        .instance_type()
                        .map(|t| t.as_str().to_string())
                        .unwrap_or_default(),
                    state,
                    private_ip:    inst.private_ip_address().unwrap_or_default().to_string(),
                    public_ip:     inst.public_ip_address().map(|s| s.to_string()),
                    platform,
                    region:        region.clone(),
                    az:            inst
                        .placement()
                        .and_then(|p| p.availability_zone())
                        .unwrap_or_default()
                        .to_string(),
                    image_id:      inst.image_id().unwrap_or_default().to_string(),
                });
            }
        }

        next_token = resp.next_token().map(|s| s.to_string());
        if next_token.is_none() {
            break;
        }
    }

    Ok(instances)
}

/// Open a new terminal window running `aws ssm start-session` for the instance.
/// Requires the AWS CLI + Session Manager plugin to be installed on the host.
#[tauri::command]
pub fn open_ssm_session(
    instance_id: String,
    region: String,
    profile_name: Option<String>,
) -> Result<(), String> {
    let profile = profile_name
        .filter(|p| !p.is_empty())
        .map(|p| format!(" --profile {p}"))
        .unwrap_or_default();

    let cmd = format!(
        "aws ssm start-session --target {instance_id} --region {region}{profile}"
    );

    open_in_terminal(&cmd)
}

// ── Platform-specific terminal launchers ─────────────────────────────────────

#[cfg(target_os = "macos")]
fn open_in_terminal(cmd: &str) -> Result<(), String> {
    // Prefer iTerm2 when available
    let use_iterm = std::path::Path::new("/Applications/iTerm.app").exists();

    let script = if use_iterm {
        format!(
            "tell application \"iTerm2\"\n  \
               create window with default profile command \"{}\"\n  \
               activate\n\
             end tell",
            cmd.replace('"', "\\\"")
        )
    } else {
        format!(
            "tell application \"Terminal\"\n  \
               do script \"{}\"\n  \
               activate\n\
             end tell",
            cmd.replace('"', "\\\"")
        )
    };

    Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("Could not open terminal: {e}"))
}

#[cfg(target_os = "linux")]
fn open_in_terminal(cmd: &str) -> Result<(), String> {
    for terminal in &[
        ("gnome-terminal", vec!["--", "bash", "-c"]),
        ("konsole",        vec!["-e", "bash", "-c"]),
        ("xterm",          vec!["-e", "bash", "-c"]),
    ] {
        let (bin, args) = terminal;
        if std::path::Path::new(&format!("/usr/bin/{bin}")).exists()
            || std::path::Path::new(&format!("/usr/local/bin/{bin}")).exists()
        {
            let mut full_args: Vec<&str> = args.clone();
            let hold_cmd = format!("{cmd}; exec bash");
            full_args.push(&hold_cmd);
            return Command::new(bin)
                .args(&full_args)
                .spawn()
                .map(|_| ())
                .map_err(|e| e.to_string());
        }
    }
    Err("No supported terminal found. Install gnome-terminal, konsole, or xterm.".into())
}

#[cfg(target_os = "windows")]
fn open_in_terminal(cmd: &str) -> Result<(), String> {
    Command::new("powershell")
        .args(["-NoExit", "-Command", cmd])
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}
