#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod aws_http;
mod commands;

use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};

/// Open an http(s) URL in the user's default browser. Only http/https are
/// accepted — any other scheme is silently dropped to avoid passing
/// arbitrary URIs to `open`, which on macOS would launch whatever handler is
/// registered for them.
#[tauri::command]
fn open_external_url(url: String) {
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return;
    }
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open").arg(&url).spawn();
    }
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("xdg-open").arg(&url).spawn();
    }
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("cmd").args(["/C", "start", "", &url]).spawn();
    }
}

/// Fire a native OS notification. Best-effort — no error propagated because
/// notifications are a secondary UX channel. macOS uses osascript (no extra
/// permissions); Linux uses notify-send; Windows uses PowerShell's toast API.
#[tauri::command]
fn notify(title: String, body: String) {
    #[cfg(target_os = "macos")]
    {
        let safe_body  = body.replace('"', "'");
        let safe_title = title.replace('"', "'");
        let script = format!(
            r#"display notification "{}" with title "{}" sound name "Submarine""#,
            safe_body, safe_title,
        );
        let _ = std::process::Command::new("osascript").arg("-e").arg(script).spawn();
    }
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("notify-send").args([&title, &body]).spawn();
    }
    #[cfg(target_os = "windows")]
    {
        let script = format!(
            "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType=WindowsRuntime] | Out-Null; \
             $tpl = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent('ToastText02'); \
             $tpl.GetElementsByTagName('text').Item(0).InnerText = '{}'; \
             $tpl.GetElementsByTagName('text').Item(1).InnerText = '{}'; \
             $n = [Windows.UI.Notifications.ToastNotification]::new($tpl); \
             [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('CloudOrbit').Show($n);",
            title.replace('\'', "`'"), body.replace('\'', "`'"),
        );
        let _ = std::process::Command::new("powershell").args(["-Command", &script]).spawn();
    }
}

/// Open the "About CloudOrbit" window. If one is already visible, focus it
/// instead of spawning a duplicate. The window is rendered by the React app
/// (`AboutWindow.tsx`) with the sloth mascot, version, tagline, and website
/// links — visually consistent with the rest of the product. A plain
/// osascript dialog only supports `.icns` for the icon, which is how the
/// default macOS About panel ends up looking so plain.
fn show_about(app: &tauri::AppHandle) {
    use tauri::{WebviewUrl, WebviewWindowBuilder};

    if let Some(win) = app.get_webview_window("about") {
        let _ = win.show();
        let _ = win.set_focus();
        return;
    }

    let url = WebviewUrl::App("index.html?window=about".into());
    let builder = WebviewWindowBuilder::new(app, "about", url)
        .title("About CloudOrbit")
        .inner_size(360.0, 520.0)
        .min_inner_size(360.0, 520.0)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .center()
        .focused(true);

    // macOS: transparent titlebar overlay keeps the visual continuity with
    // the main window. Other OSes get normal decorations.
    #[cfg(target_os = "macos")]
    let builder = builder
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .hidden_title(true);

    if let Err(e) = builder.build() {
        eprintln!("failed to open about window: {e}");
    }
}

// Needed so `get_webview_window` resolves on AppHandle.
use tauri::Manager;

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
            // External URLs (opens system browser)
            open_external_url,
            // OS notifications for session-expiry reminders
            notify,
        ])
        // Replace the default "About CloudOrbit" menu item with a custom one
        // that shows a real dialog (tagline, version, link) instead of the
        // default macOS plate with only the bundle icon + version.
        .setup(|app| {
            let about = MenuItemBuilder::with_id("about", "About CloudOrbit").build(app)?;
            let app_submenu = SubmenuBuilder::new(app, "CloudOrbit")
                .item(&about)
                .separator()
                .services()
                .separator()
                .hide()
                .hide_others()
                .show_all()
                .separator()
                .quit()
                .build()?;
            // Preserve the rest of the default menu (Edit / View / Window /
            // Help) via the builder's convenience methods so ⌘C/⌘V/⌘W still
            // work.
            let menu = MenuBuilder::new(app)
                .item(&app_submenu)
                .build()?;
            app.set_menu(menu)?;
            app.on_menu_event(|app, event| {
                if event.id() == "about" { show_about(app); }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running CloudOrbit");
}
