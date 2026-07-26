export type Screen = 'orbit' | 'accounts' | 'sessions' | 'clusters' | 'activity' | 'news' | 'settings' | 'docs' | 'support'
export type SessionStatus = 'active' | 'expiring' | 'expired' | 'idle' | 'requires-auth'
export type EnvType = 'prod' | 'staging' | 'dev' | 'sandbox' | 'unknown'

/** User-authored tag with a free-form label and any color. Rendered in place
 *  of the canonical EnvBadge when set. Kept separate from EnvType so the
 *  prod/staging/dev semantics (confirmation dialogs, etc.) still apply only
 *  to the canonical values. */
export interface CustomTag {
  label: string
  /** CSS color — e.g. `#f472b6` or `rgb(...)`. */
  color: string
}
export type MethodType = 'sso' | 'iam' | 'federated' | 'chained'

export interface SsoGroup {
  startUrl: string
  ssoRegion: string
  profiles: Profile[]
  // User-given alias from the Add Connection wizard. Used as the section
  // header in Accounts view; falls back to the startUrl hostname if missing.
  alias?: string
}
export interface Profile {
  /** Display name — usually "{accountName} / {roleName}". */
  name: string
  /** The real account name from AWS SSO — used as the group header
   *  in Accounts. Optional for backwards compat with profiles loaded
   *  from ~/.aws/config that have no separate name. */
  accountName?: string
  startUrl: string
  ssoRegion: string
  accountId: string | null
  roleName: string | null
  region: string
}
export interface Session {
  id: string
  accountId: string
  accountName: string
  roleName: string
  startUrl: string
  ssoRegion: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  sessionToken: string
  expiresAt: string // ISO string
  profileName: string
  method: MethodType
  environment: EnvType
  isFavorite: boolean
  /** True when this session's credentials are written to the [default] profile
   *  in ~/.aws/credentials. Only one session can be default at a time. */
  isDefault: boolean
  clusters?: ClusterInfo[]
}
export interface ClusterInfo {
  name: string
  arn: string
  region: string
  status: string
  version?: string
  endpoint?: string
  certificateAuthority?: string
}
export interface Ec2Instance {
  instanceId: string
  name: string
  state: string
  instanceType: string
  publicIp?: string
  privateIp: string
  platform?: string
  az?: string
  imageId?: string
}
export interface ActivityEvent {
  id: string
  time: Date
  type: 'session-start' | 'session-renew' | 'session-expire' | 'cluster-activate' | 'kubeconfig-update' | 'auth-fail' | 'reauth'
  title: string
  reference: string
  method?: MethodType
}
export interface ParsedConfig {
  ssoGroups: SsoGroup[]
}
