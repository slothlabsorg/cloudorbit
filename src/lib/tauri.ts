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

export interface ProfileCreds {
  accessKeyId: string
  secretAccessKey: string
  sessionToken: string
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

// Tauri 2 auto-maps camelCase JS args to snake_case Rust parameters. The old
// code here was passing snake_case from JS, which Tauri then treats as an
// unknown key — the Rust command fails with "missing required key startUrl".
// All invoke calls below pass camelCase keys; Tauri does the conversion.
export const api = {
  parseConfig: () => invoke<ParsedConfig>('parse_config'),

  checkSsoLogin: (startUrl: string) =>
    invoke<boolean>('check_sso_login', { startUrl }),

  ssoLoginStart: (startUrl: string, ssoRegion: string) =>
    invoke<SsoLoginStartResult>('sso_login_start', { startUrl, ssoRegion }),

  ssoLoginPoll: (clientId: string, clientSecret: string, deviceCode: string, startUrl: string, ssoRegion: string) =>
    invoke<{ success: boolean; pending?: boolean; error?: string }>('sso_login_poll', {
      clientId, clientSecret, deviceCode, startUrl, ssoRegion,
    }),

  listAccounts: (startUrl: string, ssoRegion: string) =>
    invoke<AccountInfo[]>('list_accounts', { startUrl, ssoRegion }),

  assumeRole: (startUrl: string, ssoRegion: string, accountId: string, roleName: string, region: string) =>
    invoke<AssumeRoleResult>('assume_role', { startUrl, ssoRegion, accountId, roleName, region }),

  readProfileCredentials: (profileName: string) =>
    invoke<ProfileCreds>('read_profile_credentials', { profileName }),

  startIamSession: (accessKeyId: string, secretAccessKey: string, region: string, alias: string) =>
    invoke<AssumeRoleResult>('start_iam_session', { accessKeyId, secretAccessKey, region, alias }),

  assumeRoleChained: (sourceProfile: string, roleArn: string, sessionName: string, region: string) =>
    invoke<AssumeRoleResult>('assume_role_chained', { sourceProfile, roleArn, sessionName, region }),

  assumeRoleFederated: (roleArn: string, webIdentityToken: string, sessionName: string, region: string) =>
    invoke<AssumeRoleResult>('assume_role_federated', { roleArn, webIdentityToken, sessionName, region }),

  listEksClusters: (region: string, accessKeyId: string, secretAccessKey: string, sessionToken: string) =>
    invoke<ClusterInfo[]>('list_eks_clusters', {
      region, accessKeyId, secretAccessKey, sessionToken,
    }),

  updateKubeconfig: (cluster: ClusterInfo, profileName?: string) =>
    invoke<KubeconfigResult>('update_kubeconfig', {
      cluster,
      profileName: profileName ?? null,
    }),

  listEc2Instances: (region: string, accessKeyId: string, secretAccessKey: string, sessionToken: string) =>
    invoke<Ec2Instance[]>('list_ec2_instances', {
      region, accessKeyId, secretAccessKey, sessionToken,
    }),

  openSsmSession: (instanceId: string, region: string, profileName: string) =>
    invoke<void>('open_ssm_session', { instanceId, region, profileName }),

  openWebConsole: (accessKeyId: string, secretAccessKey: string, sessionToken: string, region: string, destination?: string) =>
    invoke<void>('open_web_console', {
      accessKeyId, secretAccessKey, sessionToken, region,
      destination: destination ?? null,
    }),

  openExternalUrl: (url: string) => invoke<void>('open_external_url', { url }),

  notify: (title: string, body: string) =>
    invoke<void>('notify', { title, body }),

  clearSessionCredentials: (profileName: string, accessKeyId: string) =>
    invoke<void>('clear_session_credentials', { profileName, accessKeyId }),

  setDefaultSession: (accessKeyId: string, secretAccessKey: string, sessionToken: string, region: string) =>
    invoke<void>('set_default_session', { accessKeyId, secretAccessKey, sessionToken, region }),

  listCredentialSessions: () =>
    invoke<Array<{
      profileName: string
      accessKeyId: string
      secretAccessKey: string
      sessionToken: string
      region: string | null
      expiresAt: string | null
      isDefault: boolean
    }>>('list_credential_sessions'),

  writeSsoConfig: (startUrl: string, ssoRegion: string, accounts: AccountInfo[]) =>
    invoke<{ sessionName: string; profileCount: number }>('write_sso_config', {
      startUrl, ssoRegion,
      accounts: accounts.map(a => ({
        accountId: a.accountId,
        accountName: a.accountName,
        roles: a.roles.map(r => ({ roleName: r.roleName })),
      })),
    }),
}
