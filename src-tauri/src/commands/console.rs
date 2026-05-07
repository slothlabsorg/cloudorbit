/// Open the AWS Management Console via the federation sign-in endpoint.
///
/// Flow:
///   1. Exchange the current temporary credentials for a federation sign-in token
///      (GET https://signin.aws.amazon.com/federation?Action=getSigninToken …)
///   2. Build a console URL that contains the token
///   3. Open that URL in the system browser
///
/// Because we use `reqwest` with `native-tls` the TLS stack reads from the system
/// Keychain, so corporate CAs / Cloudflare certificates are trusted automatically.

fn percent_encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len() * 3);
    for byte in s.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9'
            | b'-' | b'_' | b'.' | b'~' => out.push(byte as char),
            b => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}

#[tauri::command]
pub async fn open_web_console(
    access_key_id: String,
    secret_access_key: String,
    session_token: String,
    region: String,
    destination: Option<String>,
) -> Result<(), String> {
    // Build the session credential object the federation endpoint expects
    let session = serde_json::json!({
        "sessionId":    access_key_id,
        "sessionKey":   secret_access_key,
        "sessionToken": session_token,
    })
    .to_string();

    // Step 1 — get a short-lived sign-in token
    let client = reqwest::Client::builder()
        .use_native_tls()
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .get("https://signin.aws.amazon.com/federation")
        .query(&[
            ("Action", "getSigninToken"),
            ("SessionDuration", "43200"),   // 12 h max
            ("Session", &session),
        ])
        .send()
        .await
        .map_err(|e| format!("Federation request failed: {e}"))?
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Failed to parse federation response: {e}"))?;

    let signin_token = resp["SigninToken"]
        .as_str()
        .ok_or("No SigninToken in federation response")?;

    // Step 2 — build the console URL
    let dest = destination.unwrap_or_else(|| {
        format!("https://{region}.console.aws.amazon.com/console/home?region={region}")
    });

    let console_url = format!(
        "https://signin.aws.amazon.com/federation\
         ?Action=login\
         &Issuer=cloudorbit\
         &Destination={}\
         &SigninToken={}",
        percent_encode(&dest),
        signin_token,
    );

    // Step 3 — open in the system browser
    open::that(&console_url).map_err(|e| e.to_string())
}
