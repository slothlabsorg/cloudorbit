// Shared helper that builds an `aws_config::SdkConfig` using a native-tls
// HTTP client so TLS trust falls back to the operating-system trust store.
//
// Why this exists: the aws-sdk-rust default HTTP client uses rustls with
// `webpki-roots` — a static Mozilla CA bundle compiled into the binary. That
// bundle does NOT include enterprise root CAs installed by SSL-inspection
// proxies (Zscaler, Netskope, Cloudflare Zero Trust, etc.). On those
// networks every AWS API call fails with `invalid peer certificate:
// UnknownCA`. native-tls on macOS delegates to SecureTransport which reads
// the user+system Keychain, so corporate CAs are honored automatically.

use aws_config::{BehaviorVersion, Region, SdkConfig};
use aws_smithy_runtime::client::http::hyper_014::HyperClientBuilder;

pub async fn config_for_region(region: &str) -> SdkConfig {
    let https = hyper_tls::HttpsConnector::new();
    let http_client = HyperClientBuilder::new().build(https);

    aws_config::defaults(BehaviorVersion::latest())
        .http_client(http_client)
        .region(Region::new(region.to_string()))
        .no_credentials()
        .load()
        .await
}

/// Like `config_for_region_with_creds` but also respects `AWS_ENDPOINT_URL`
/// so integration tests can point at LocalStack without code changes.
pub async fn config_for_region_with_creds_and_endpoint(
    region: &str,
    creds: aws_credential_types::Credentials,
) -> SdkConfig {
    let https = hyper_tls::HttpsConnector::new();
    let http_client = HyperClientBuilder::new().build(https);

    let mut builder = aws_config::defaults(BehaviorVersion::latest())
        .http_client(http_client)
        .region(Region::new(region.to_string()))
        .credentials_provider(creds);

    if let Ok(endpoint) = std::env::var("AWS_ENDPOINT_URL") {
        if !endpoint.is_empty() {
            builder = builder.endpoint_url(endpoint);
        }
    }

    builder.load().await
}

pub async fn config_for_region_with_creds(
    region: &str,
    creds: aws_credential_types::Credentials,
) -> SdkConfig {
    let https = hyper_tls::HttpsConnector::new();
    let http_client = HyperClientBuilder::new().build(https);

    aws_config::defaults(BehaviorVersion::latest())
        .http_client(http_client)
        .region(Region::new(region.to_string()))
        .credentials_provider(creds)
        .load()
        .await
}
