import type { EnvType } from '@/types'

export function formatExpiry(isoString: string | null | undefined): { label: string; status: 'active' | 'expiring' | 'expired' } {
  if (!isoString) return { label: 'Unknown', status: 'active' }
  const diffMs = new Date(isoString).getTime() - Date.now()
  if (diffMs <= 0) return { label: 'Expired', status: 'expired' }
  if (diffMs < 60000) return { label: '<1m', status: 'expiring' }
  const diffMin = Math.floor(diffMs / 60000)
  const hours = Math.floor(diffMin / 60)
  const mins = diffMin % 60
  const label = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  const status = diffMin < 30 ? 'expiring' : 'active'
  return { label, status }
}

export function detectEnv(name: string): EnvType {
  const n = name.toLowerCase()
  if (/prod|production|live/.test(n)) return 'prod'
  if (/stag|staging/.test(n)) return 'staging'
  if (/dev|develop|development/.test(n)) return 'dev'
  if (/sandbox|sand|test/.test(n)) return 'sandbox'
  return 'unknown'
}

export function envOverrideKey(startUrl: string, accountId: string): string {
  return `${startUrl}|${accountId}`
}

/**
 * Derive the clean account name from a Profile. Handles three legacy shapes:
 *  1. Fresh wizard output has `accountName` set explicitly — return it.
 *  2. Pre-fix wizard produced `name = "polaris-development / PolarisReadOnly"`
 *     — split on " / ".
 *  3. `parse_config` (reads ~/.aws/config) produces `name =
 *     "polaris-development-PolarisReadOnly"` — strip `-{roleName}` suffix.
 *
 * We apply this once at the load boundary (App useEffect) so the rest of
 * the UI never has to think about the historical naming formats.
 */
export function accountNameFrom(profile: {
  name: string
  accountName?: string
  roleName?: string | null
}): string {
  if (profile.accountName) return profile.accountName
  if (profile.name.includes(' / ')) return profile.name.split(' / ')[0]
  if (profile.roleName && profile.name.endsWith(`-${profile.roleName}`)) {
    return profile.name.slice(0, -profile.roleName.length - 1)
  }
  return profile.name
}

/** Override takes precedence over name-based auto-detection. */
export function resolveEnv(
  overrides: Record<string, EnvType>,
  startUrl: string,
  accountId: string | null | undefined,
  accountName: string,
): EnvType {
  if (accountId) {
    const o = overrides[envOverrideKey(startUrl, accountId)]
    if (o) return o
  }
  return detectEnv(accountName)
}

export function timeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
