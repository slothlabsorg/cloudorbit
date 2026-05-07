// Tauri v2 IPC bridge — translates camelCase JS → snake_case Rust params
;(function () {
  const { invoke } = window.__TAURI__.core

  window.aws = {
    // ── Config & SSO ─────────────────────────────────────────────────────────
    parseConfig: () =>
      invoke('parse_config'),

    checkSsoLogin: (startUrl) =>
      invoke('check_sso_login', { start_url: startUrl }),

    ssoLoginStart: ({ startUrl, ssoRegion }) =>
      invoke('sso_login_start', { start_url: startUrl, sso_region: ssoRegion }),

    ssoLoginPoll: ({ clientId, clientSecret, deviceCode, startUrl, ssoRegion }) =>
      invoke('sso_login_poll', {
        client_id: clientId, client_secret: clientSecret,
        device_code: deviceCode, start_url: startUrl, sso_region: ssoRegion,
      }),

    listAccounts: ({ startUrl, ssoRegion }) =>
      invoke('list_accounts', { start_url: startUrl, sso_region: ssoRegion }),

    // ── Credentials ───────────────────────────────────────────────────────────
    assumeRole: ({ startUrl, ssoRegion, accountId, roleName }) =>
      invoke('assume_role', {
        start_url: startUrl, sso_region: ssoRegion,
        account_id: accountId, role_name: roleName,
      }),

    writeSsoConfig: ({ startUrl, ssoRegion, accounts }) =>
      invoke('write_sso_config', { start_url: startUrl, sso_region: ssoRegion, accounts }),

    // ── EKS ──────────────────────────────────────────────────────────────────
    listEksClusters: ({ region, accessKeyId, secretAccessKey, sessionToken }) =>
      invoke('list_eks_clusters', {
        region,
        access_key_id: accessKeyId,
        secret_access_key: secretAccessKey,
        session_token: sessionToken,
      }),

    updateKubeconfig: ({ cluster, profileName }) =>
      invoke('update_kubeconfig', { cluster, profile_name: profileName ?? null }),

    // ── EC2 & SSM ─────────────────────────────────────────────────────────────
    listEc2Instances: ({ region, accessKeyId, secretAccessKey, sessionToken }) =>
      invoke('list_ec2_instances', {
        region,
        access_key_id: accessKeyId,
        secret_access_key: secretAccessKey,
        session_token: sessionToken,
      }),

    openSsmSession: ({ instanceId, region, profileName }) =>
      invoke('open_ssm_session', {
        instance_id: instanceId,
        region,
        profile_name: profileName ?? null,
      }),

    // ── AWS Web Console ────────────────────────────────────────────────────────
    openWebConsole: ({ accessKeyId, secretAccessKey, sessionToken, region, destination }) =>
      invoke('open_web_console', {
        access_key_id: accessKeyId,
        secret_access_key: secretAccessKey,
        session_token: sessionToken,
        region,
        destination: destination ?? null,
      }),
  }
})()
