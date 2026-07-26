import type { Session, ClusterInfo, ActivityEvent } from '@/types'

export const mockSessions: Session[] = [
  {
    id: '1', accountId: '123456789012', accountName: 'Acme Production',
    roleName: 'Admin', startUrl: 'https://acme.awsapps.com/start',
    ssoRegion: 'us-east-1', region: 'us-east-1',
    accessKeyId: 'ASIA...', secretAccessKey: '...', sessionToken: '...',
    expiresAt: new Date(Date.now() + 4980000).toISOString(),
    profileName: '123456789012-Admin', method: 'sso', environment: 'prod', isFavorite: true, isDefault: false,
    clusters: [{ name: 'prod-cluster', arn: 'arn:aws:eks:us-east-1:123456789012:cluster/prod-cluster', region: 'us-east-1', status: 'ACTIVE', version: '1.29' }],
  },
  {
    id: '2', accountId: '234567890123', accountName: 'Acme Staging',
    roleName: 'Developer', startUrl: 'https://acme.awsapps.com/start',
    ssoRegion: 'us-east-1', region: 'us-east-1',
    accessKeyId: 'ASIA...', secretAccessKey: '...', sessionToken: '...',
    expiresAt: new Date(Date.now() + 4200000).toISOString(),
    profileName: '234567890123-Developer', method: 'federated', environment: 'staging', isFavorite: false, isDefault: false,
    clusters: [{ name: 'staging-cluster', arn: 'arn:aws:eks:us-east-1:234567890123:cluster/staging-cluster', region: 'us-east-1', status: 'ACTIVE', version: '1.28' }],
  },
  {
    id: '3', accountId: '345678901234', accountName: 'Platform Shared',
    roleName: 'ReadOnly', startUrl: 'https://acme.awsapps.com/start',
    ssoRegion: 'us-east-1', region: 'us-west-2',
    accessKeyId: 'ASIA...', secretAccessKey: '...', sessionToken: '...',
    expiresAt: new Date(Date.now() + 1320000).toISOString(),
    profileName: '345678901234-ReadOnly', method: 'chained', environment: 'dev', isFavorite: false, isDefault: false,
  },
  {
    id: '4', accountId: '456789012345', accountName: 'Data Sandbox',
    roleName: 'Engineer', startUrl: 'https://acme.awsapps.com/start',
    ssoRegion: 'us-east-1', region: 'eu-west-1',
    accessKeyId: 'ASIA...', secretAccessKey: '...', sessionToken: '...',
    expiresAt: new Date(Date.now() - 3600000).toISOString(),
    profileName: '456789012345-Engineer', method: 'iam', environment: 'sandbox', isFavorite: false, isDefault: false,
  },
]

export const mockClusters: ClusterInfo[] = [
  { name: 'prod-cluster', arn: 'arn:aws:eks:us-east-1:123456789012:cluster/prod-cluster', region: 'us-east-1', status: 'ACTIVE', version: '1.29' },
  { name: 'staging-cluster', arn: 'arn:aws:eks:us-east-1:234567890123:cluster/staging-cluster', region: 'us-east-1', status: 'ACTIVE', version: '1.28' },
]

const now = new Date()
export const mockActivity: ActivityEvent[] = [
  { id: 'a1', time: new Date(now.getTime() - 1800000), type: 'session-start', title: 'Session started', reference: 'Acme Production / Admin', method: 'sso' },
  { id: 'a2', time: new Date(now.getTime() - 3600000), type: 'cluster-activate', title: 'Cluster activated', reference: 'prod-cluster' },
  { id: 'a3', time: new Date(now.getTime() - 5400000), type: 'session-renew', title: 'Session renewed', reference: 'Acme Production / Admin', method: 'sso' },
  { id: 'a4', time: new Date(now.getTime() - 86400000), type: 'session-expire', title: 'Session expired', reference: 'Data Sandbox / Engineer', method: 'iam' },
]
