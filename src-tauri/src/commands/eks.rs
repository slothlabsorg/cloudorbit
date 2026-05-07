use std::fs;
use dirs::home_dir;
use serde::{Deserialize, Serialize};
use serde_yaml::Value;
use aws_config::Region;
use aws_credential_types::Credentials as AwsCreds;
use aws_sdk_eks::Client as EksClient;

// ── Types ────────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ClusterInfo {
    pub name: String,
    pub arn: String,
    pub status: String,
    pub version: String,
    pub endpoint: String,
    pub region: String,
    pub certificate_authority: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KubeconfigResult {
    pub context_name: String,
    pub kubeconfig_path: String,
}

// ── Commands ─────────────────────────────────────────────────────────────────

/// List all EKS clusters in the given region using the provided credentials.
#[tauri::command]
pub async fn list_eks_clusters(
    region: String,
    access_key_id: String,
    secret_access_key: String,
    session_token: String,
) -> Result<Vec<ClusterInfo>, String> {
    let creds = AwsCreds::new(
        access_key_id,
        secret_access_key,
        Some(session_token),
        None,
        "cloudorbit",
    );

    let cfg = aws_config::defaults(aws_config::BehaviorVersion::latest())
        .region(Region::new(region.clone()))
        .credentials_provider(creds)
        .load()
        .await;

    let eks = EksClient::new(&cfg);

    let names = eks
        .list_clusters()
        .send()
        .await
        .map_err(|e| e.to_string())?
        .clusters()
        .to_vec();

    let mut clusters = Vec::new();
    for name in names {
        if let Ok(desc) = eks.describe_cluster().name(&name).send().await {
            if let Some(c) = desc.cluster() {
                clusters.push(ClusterInfo {
                    name: c.name().unwrap_or_default().to_string(),
                    arn: c.arn().unwrap_or_default().to_string(),
                    status: c
                        .status()
                        .map(|s| s.as_str().to_uppercase())
                        .unwrap_or_else(|| "UNKNOWN".to_string()),
                    version: c.version().unwrap_or_default().to_string(),
                    endpoint: c.endpoint().unwrap_or_default().to_string(),
                    region: region.clone(),
                    certificate_authority: c
                        .certificate_authority()
                        .and_then(|ca| ca.data())
                        .unwrap_or_default()
                        .to_string(),
                });
            }
        }
    }

    Ok(clusters)
}

/// Merge a cluster entry into ~/.kube/config and set it as current-context.
#[tauri::command]
pub fn update_kubeconfig(
    cluster: ClusterInfo,
    profile_name: Option<String>,
) -> Result<KubeconfigResult, String> {
    let kubeconfig_path = std::env::var("KUBECONFIG")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| home_dir().unwrap().join(".kube").join("config"));

    let content = fs::read_to_string(&kubeconfig_path).unwrap_or_default();
    let mut cfg: Value = if content.is_empty() {
        serde_yaml::from_str(
            "apiVersion: v1\nkind: Config\npreferences: {}\nclusters: []\ncontexts: []\nusers: []\n",
        )
        .unwrap()
    } else {
        serde_yaml::from_str(&content).map_err(|e| e.to_string())?
    };

    let ctx_name = if cluster.arn.is_empty() {
        format!("arn:aws:eks:{}:unknown:cluster/{}", cluster.region, cluster.name)
    } else {
        cluster.arn.clone()
    };

    // Build exec args
    let mut exec_args: Vec<Value> = vec![
        Value::String("eks".into()),
        Value::String("get-token".into()),
        Value::String("--cluster-name".into()),
        Value::String(cluster.name.clone()),
        Value::String("--region".into()),
        Value::String(cluster.region.clone()),
    ];
    if let Some(ref p) = profile_name {
        exec_args.push(Value::String("--profile".into()));
        exec_args.push(Value::String(p.clone()));
    }

    // Cluster entry
    let cluster_entry = serde_yaml::to_value(serde_json::json!({
        "name": ctx_name,
        "cluster": {
            "server": cluster.endpoint,
            "certificate-authority-data": cluster.certificate_authority
        }
    }))
    .unwrap();

    // User entry
    let user_entry = serde_yaml::to_value(serde_json::json!({
        "name": ctx_name,
        "user": {
            "exec": {
                "apiVersion": "client.authentication.k8s.io/v1beta1",
                "command": "aws",
                "args": exec_args,
                "interactiveMode": "IfAvailable",
                "provideClusterInfo": false
            }
        }
    }))
    .unwrap();

    // Context entry
    let context_entry = serde_yaml::to_value(serde_json::json!({
        "name": ctx_name,
        "context": { "cluster": ctx_name, "user": ctx_name }
    }))
    .unwrap();

    upsert_by_name(cfg.get_mut("clusters").unwrap(), &ctx_name, cluster_entry);
    upsert_by_name(cfg.get_mut("users").unwrap(), &ctx_name, user_entry);
    upsert_by_name(cfg.get_mut("contexts").unwrap(), &ctx_name, context_entry);
    cfg["current-context"] = Value::String(ctx_name.clone());

    fs::create_dir_all(kubeconfig_path.parent().unwrap()).map_err(|e| e.to_string())?;
    fs::write(
        &kubeconfig_path,
        serde_yaml::to_string(&cfg).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;

    Ok(KubeconfigResult {
        context_name: ctx_name,
        kubeconfig_path: kubeconfig_path.to_string_lossy().to_string(),
    })
}

fn upsert_by_name(arr: &mut Value, name: &str, entry: Value) {
    if let Value::Sequence(seq) = arr {
        for item in seq.iter_mut() {
            if item.get("name").and_then(|v| v.as_str()) == Some(name) {
                *item = entry;
                return;
            }
        }
        seq.push(entry);
    }
}

// ── Unit tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use serde_yaml::Value;

    fn yaml_entry(name: &str, data: &str) -> Value {
        serde_yaml::from_str(&format!("name: {}\ndata: {}", name, data)).unwrap()
    }

    #[test]
    fn upsert_inserts_into_empty_sequence() {
        let mut arr = Value::Sequence(vec![]);
        upsert_by_name(&mut arr, "ctx1", yaml_entry("ctx1", "abc"));
        let seq = arr.as_sequence().unwrap();
        assert_eq!(seq.len(), 1);
        assert_eq!(seq[0]["name"].as_str(), Some("ctx1"));
    }

    #[test]
    fn upsert_updates_existing_entry_in_place() {
        let mut arr = Value::Sequence(vec![yaml_entry("ctx1", "old")]);
        upsert_by_name(&mut arr, "ctx1", yaml_entry("ctx1", "new"));
        let seq = arr.as_sequence().unwrap();
        assert_eq!(seq.len(), 1); // no duplicate
        assert_eq!(seq[0]["data"].as_str(), Some("new"));
    }

    #[test]
    fn upsert_appends_when_name_not_found() {
        let mut arr = Value::Sequence(vec![yaml_entry("ctx1", "data1")]);
        upsert_by_name(&mut arr, "ctx2", yaml_entry("ctx2", "data2"));
        let seq = arr.as_sequence().unwrap();
        assert_eq!(seq.len(), 2);
        assert_eq!(seq[1]["name"].as_str(), Some("ctx2"));
    }

    #[test]
    fn upsert_preserves_other_entries_when_updating() {
        let mut arr = Value::Sequence(vec![
            yaml_entry("ctx1", "d1"),
            yaml_entry("ctx2", "d2"),
            yaml_entry("ctx3", "d3"),
        ]);
        upsert_by_name(&mut arr, "ctx2", yaml_entry("ctx2", "updated"));
        let seq = arr.as_sequence().unwrap();
        assert_eq!(seq.len(), 3);
        assert_eq!(seq[0]["name"].as_str(), Some("ctx1"));
        assert_eq!(seq[1]["data"].as_str(), Some("updated"));
        assert_eq!(seq[2]["name"].as_str(), Some("ctx3"));
    }

    #[test]
    fn upsert_does_nothing_on_non_sequence_value() {
        let mut arr = Value::Mapping(Default::default());
        upsert_by_name(&mut arr, "ctx1", yaml_entry("ctx1", "data"));
        // Should not panic, mapping stays empty
        assert!(arr.as_mapping().unwrap().is_empty());
    }
}
