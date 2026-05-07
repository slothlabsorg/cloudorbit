#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            // Config / SSO
            commands::config::parse_config,
            commands::sso::check_sso_login,
            commands::sso::sso_login_start,
            commands::sso::sso_login_poll,
            commands::sso::list_accounts,
            // Credentials & profiles
            commands::credentials::assume_role,
            commands::credentials::write_sso_config,
            // EKS
            commands::eks::list_eks_clusters,
            commands::eks::update_kubeconfig,
            // EC2 / SSM
            commands::ec2::list_ec2_instances,
            commands::ec2::open_ssm_session,
            // Web Console
            commands::console::open_web_console,
        ])
        .run(tauri::generate_context!())
        .expect("error while running CloudOrbit");
}
