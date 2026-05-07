export type Screen = 'orbit' | 'accounts' | 'sessions' | 'clusters' | 'activity' | 'settings' | 'docs' | 'support'
export type SessionStatus = 'active' | 'expiring' | 'expired' | 'idle' | 'requires-auth'
export type EnvType = 'prod' | 'staging' | 'dev' | 'sandbox' | 'unknown'
export type MethodType = 'sso' | 'iam' | 'federated' | 'chained'

export interface SsoGroup {
  startUrl: string
  ssoRegion: string
  profiles: Profile[]
}
export interface Profile {
  name: string
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
