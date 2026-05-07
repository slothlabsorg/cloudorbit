// Safe invoke that works in browser (no Tauri) for dev/testing
type TauriInvoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>

function getInvoke(): TauriInvoke {
  const w = window as Window & { __TAURI__?: { core?: { invoke?: TauriInvoke } } }
  return w.__TAURI__?.core?.invoke ?? ((_cmd: string, _args?: Record<string, unknown>) => {
    console.warn('Tauri not available, using mock data')
    return Promise.reject(new Error('not-in-tauri'))
  })
}

export const invoke: TauriInvoke = (cmd, args) => getInvoke()(cmd, args)

// Typed wrappers for all commands
import type { ParsedConfig, ClusterInfo, Ec2Instance } from '@/types'

export interface SsoLoginStartResult {
  clientId: string
  clientSecret: string
  deviceCode: string
  interval: number
  verificationUriComplete: string
}

export interface AssumeRoleResult {
  profileName: string
  accessKeyId: string
  secretAccessKey: string
  sessionToken: string
  expiresAt: string | null
  accountId: string
  roleName: string
}

export interface AccountInfo {
  accountId: string
  accountName: string
  accountEmail: string
  roles: { roleName: string; accountId: string }[]
}

export interface KubeconfigResult {
  contextName: string
  kubeconfigPath: string
}

export const api = {
  parseConfig: () => invoke<ParsedConfig>('parse_config'),

  checkSsoLogin: (startUrl: string) =>
    invoke<boolean>('check_sso_login', { start_url: startUrl }),

  ssoLoginStart: (startUrl: string, ssoRegion: string) =>
    invoke<SsoLoginStartResult>('sso_login_start', { start_url: startUrl, sso_region: ssoRegion }),

  ssoLoginPoll: (clientId: string, clientSecret: string, deviceCode: string, startUrl: string, ssoRegion: string) =>
    invoke<{ success: boolean; pending?: boolean; error?: string }>('sso_login_poll', {
      client_id: clientId,
      client_secret: clientSecret,
      device_code: deviceCode,
      start_url: startUrl,
      sso_region: ssoRegion,
    }),

  listAccounts: (startUrl: string, ssoRegion: string) =>
    invoke<AccountInfo[]>('list_accounts', { start_url: startUrl, sso_region: ssoRegion }),

  assumeRole: (startUrl: string, ssoRegion: string, accountId: string, roleName: string) =>
    invoke<AssumeRoleResult>('assume_role', {
      start_url: startUrl,
      sso_region: ssoRegion,
      account_id: accountId,
      role_name: roleName,
    }),

  listEksClusters: (region: string, accessKeyId: string, secretAccessKey: string, sessionToken: string) =>
    invoke<ClusterInfo[]>('list_eks_clusters', {
      region,
      access_key_id: accessKeyId,
      secret_access_key: secretAccessKey,
      session_token: sessionToken,
    }),

  updateKubeconfig: (cluster: ClusterInfo, profileName?: string) =>
    invoke<KubeconfigResult>('update_kubeconfig', {
      cluster,
      profile_name: profileName ?? null,
    }),

  listEc2Instances: (region: string, accessKeyId: string, secretAccessKey: string, sessionToken: string) =>
    invoke<Ec2Instance[]>('list_ec2_instances', {
      region,
      access_key_id: accessKeyId,
      secret_access_key: secretAccessKey,
      session_token: sessionToken,
    }),

  openSsmSession: (instanceId: string, region: string, profileName: string) =>
    invoke<void>('open_ssm_session', {
      instance_id: instanceId,
      region,
      profile_name: profileName,
    }),

  openWebConsole: (accessKeyId: string, secretAccessKey: string, sessionToken: string, region: string, destination?: string) =>
    invoke<void>('open_web_console', {
      access_key_id: accessKeyId,
      secret_access_key: secretAccessKey,
      session_token: sessionToken,
      region,
      destination: destination ?? null,
    }),
}
