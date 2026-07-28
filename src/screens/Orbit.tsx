import React, { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Session, SsoGroup, Profile, Screen, ClusterInfo, ActivityEvent, EnvType } from '@/types'
import { formatExpiry, detectEnv, envOverrideKey } from '@/lib/time'
import { EnvBadge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'
import { api } from '@/lib/tauri'

// ── Orbit — Dashboard ────────────────────────────────────────────────────────
// The home screen. Top-of-fold is a stats band + a live session-timeline
// chart; below is a tabbed view of Active / Favorites / Recent role cards,
// each with quick actions (start/renew, console, copy creds, detect EKS).
//
// The existing Orbit was a flat table that duplicated what Accounts now
// shows much better. This file replaces it with a dashboard feel.

interface OrbitProps {
  sessions: Session[]
  ssoGroups: SsoGroup[]
  isLoading: boolean
  selectedSession: Session | null
  activity: ActivityEvent[]
  favorites: Set<string>
  envOverrides: Record<string, EnvType>
  onSelectSession: (session: Session) => void
  onStartSession: (profile: Profile) => Promise<void>
  onRenewSession: (session: Session) => Promise<void>
  onStopSession: (session: Session) => Promise<void>
  onSetDefault: (session: Session) => Promise<void>
  onOpenConsole: (session: Session) => Promise<void>
  onDetectClusters?: (session: Session) => Promise<void>
  onActivateCluster?: (cluster: ClusterInfo, session: Session) => Promise<void>
  onToggleFavorite: (key: string) => void
  onAddConnection?: () => void
  onNavigate?: (screen: Screen) => void
  updateInfo?: { version: string; body: string | null } | null
  onUpdateClick?: () => void
  onDismissUpdate?: () => void
  /** Key → SSO login state for in-flight re-auth flows (key = accountId-roleName) */
  ssoLoginState?: Record<string, { status: string; verificationUrl?: string; error?: string }>
}

function favKey(startUrl: string, accountId: string, roleName: string): string {
  return `${startUrl}|${accountId}|${roleName}`
}

function maskId(id: string): string {
  return id.length <= 4 ? id : `••••${id.slice(-4)}`
}

// ── Top stats band ───────────────────────────────────────────────────────────
function StatTile({ label, value, tone, onClick }: { label: string; value: number | string; tone: string; onClick?: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      disabled={!onClick}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex-1 min-w-0 flex flex-col items-start gap-1 bg-bg-elevated border border-border rounded-xl px-4 py-3 transition ${onClick ? 'hover:border-primary/40 cursor-pointer text-left' : 'cursor-default'}`}
    >
      <span className="text-[10px] text-text-muted font-semibold uppercase tracking-wider">{label}</span>
      <span className={`text-2xl font-display font-bold ${tone}`}>{value}</span>
    </motion.button>
  )
}

// ── Session timeline chart ───────────────────────────────────────────────────
// Horizontal bars — one per active session — showing elapsed vs remaining
// against a common scale (longest remaining session = 100%). Gives an
// at-a-glance view of which session expires next and how much life it has.
function SessionTimeline({ sessions, now }: { sessions: Session[]; now: number }) {
  const active = sessions.filter(s => new Date(s.expiresAt).getTime() > now)
  if (active.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 bg-bg-elevated border border-border rounded-xl">
        <p className="text-text-muted text-xs">No active sessions</p>
      </div>
    )
  }
  // Assumption: default session length is 1h (SSO STS). Falls back to
  // `expiresAt - (expiresAt - now) * 2` when we don't track the start time.
  const DEFAULT_LIFETIME_MS = 3600_000
  const maxRemaining = Math.max(...active.map(s => new Date(s.expiresAt).getTime() - now))
  const scaleMs = Math.max(maxRemaining, DEFAULT_LIFETIME_MS)

  return (
    <div className="bg-bg-elevated border border-border rounded-xl px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] text-text-muted font-semibold uppercase tracking-wider">
          Session timeline
        </p>
        <p className="text-[10px] text-text-muted font-mono">{active.length} active</p>
      </div>
      <div className="space-y-2">
        {active
          .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime())
          .map(s => {
            const remainMs = new Date(s.expiresAt).getTime() - now
            const remainMin = Math.max(0, Math.round(remainMs / 60000))
            const pct = Math.max(2, Math.min(100, (remainMs / scaleMs) * 100))
            const warn = remainMs <= 15 * 60000
            const crit = remainMs <= 5  * 60000
            return (
              <div key={s.id} className="grid items-center gap-3" style={{ gridTemplateColumns: '1fr 160px 60px' }}>
                <div className="min-w-0 flex items-center gap-2">
                  <EnvBadge env={s.environment} />
                  <span className="text-xs text-text-primary truncate">{s.accountName}</span>
                  <span className="text-[10px] text-text-muted font-mono truncate">/ {s.roleName}</span>
                </div>
                <div className="h-1.5 rounded-full bg-bg-surface overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className={`h-full ${crit ? 'bg-danger' : warn ? 'bg-warning' : 'bg-success'}`}
                  />
                </div>
                <span className={`text-[11px] font-mono text-right ${crit ? 'text-danger' : warn ? 'text-warning' : 'text-text-muted'}`}>
                  {remainMin}m
                </span>
              </div>
            )
          })}
      </div>
    </div>
  )
}

// ── Role card ────────────────────────────────────────────────────────────────
interface RoleCardInput {
  profile: Profile
  accountName: string
  session: Session | null
  env: EnvType
  envOverridden: boolean
  favorite: boolean
}

function RoleCard({
  input, isStarting, isRenewing, isDetecting,
  onStart, onRenew, onStop, onSetDefault, onConsole, onCopyCreds, onDetect, onSelect, onToggleFavorite,
  ssoLogin,
}: {
  input: RoleCardInput
  isStarting: boolean
  isRenewing: boolean
  isDetecting: boolean
  onStart: () => void
  onRenew: () => void
  onStop: () => void
  onSetDefault: () => void
  onConsole: () => void
  onCopyCreds: () => void
  onDetect: () => void
  onSelect: () => void
  onToggleFavorite: () => void
  ssoLogin?: { status: string; verificationUrl?: string; error?: string }
}) {
  const { profile, accountName, session, env, favorite } = input
  const now = Date.now()
  const expired = session && new Date(session.expiresAt).getTime() <= now
  const remainMs = session ? new Date(session.expiresAt).getTime() - now : 0
  const remainMin = session && remainMs > 0 ? Math.round(remainMs / 60000) : 0
  const warn = !!session && !expired && remainMs <= 15 * 60000
  const crit = !!session && !expired && remainMs <= 5  * 60000
  const pct = session && !expired
    ? Math.max(2, Math.min(100, (remainMs / 3600000) * 100))
    : 0
  const active = !!session && !expired

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={() => session && onSelect()}
      className={`flex flex-col bg-bg-elevated border rounded-xl overflow-hidden transition-colors ${
        active ? 'border-success/40 hover:border-success/60' : 'border-border hover:border-primary/40'
      } ${session ? 'cursor-pointer' : ''}`}
    >
      {/* Header */}
      <div className="flex items-start gap-2 px-4 pt-3">
        <EnvBadge env={env} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-text-primary text-sm font-semibold truncate">{accountName}</p>
            {session?.isDefault && (
              <span className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 uppercase tracking-wider">
                default
              </span>
            )}
          </div>
          <p className="text-text-muted text-[11px] font-mono truncate">{profile.roleName}</p>
        </div>
        {active && (
          <button
            onClick={e => { e.stopPropagation(); onSetDefault() }}
            className={`rounded p-0.5 transition-colors flex-shrink-0 ${
              session?.isDefault ? 'text-primary' : 'text-text-muted hover:text-primary'
            }`}
            title={session?.isDefault ? 'Unpin as [default] profile' : 'Pin as [default] AWS profile'}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill={session?.isDefault ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
            </svg>
          </button>
        )}
        <button
          onClick={e => { e.stopPropagation(); onToggleFavorite() }}
          className={`rounded p-0.5 transition-colors flex-shrink-0 ${favorite ? 'text-warning' : 'text-text-muted hover:text-warning'}`}
          title={favorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill={favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        </button>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 px-4 pt-1.5 pb-2 text-[11px] text-text-muted font-mono">
        <span>{profile.accountId ? maskId(profile.accountId) : '—'}</span>
        <span>{profile.region}</span>
      </div>

      {/* Status strip */}
      <div className="px-4 pb-2">
        {active ? (
          <>
            <div className="flex items-center justify-between mb-1">
              <span className="flex items-center gap-1.5 text-[11px]">
                <span className={`w-1.5 h-1.5 rounded-full ${crit ? 'bg-danger' : warn ? 'bg-warning' : 'bg-success'}`} />
                <span className={crit ? 'text-danger' : warn ? 'text-warning' : 'text-success'}>
                  {warn || crit ? 'Expiring' : 'Active'}
                </span>
              </span>
              <span className={`text-[11px] font-mono ${crit ? 'text-danger' : warn ? 'text-warning' : 'text-text-secondary'}`}>
                {remainMin}m left
              </span>
            </div>
            <div className="h-1 rounded-full bg-bg-surface overflow-hidden">
              <div className={`h-full transition-all ${crit ? 'bg-danger' : warn ? 'bg-warning' : 'bg-success'}`}
                style={{ width: `${pct}%` }} />
            </div>
          </>
        ) : expired ? (
          <div className="flex items-center gap-1.5 text-[11px] text-danger">
            <span className="w-1.5 h-1.5 rounded-full bg-danger" />
            <span>Expired</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-text-muted/40" />
            <span>Idle</span>
          </div>
        )}
      </div>

      {/* SSO re-auth banner — shown when browser approval is pending */}
      {ssoLogin?.status === 'polling' && (
        <div className="mx-3 mb-2 rounded-lg border border-warning/40 bg-warning/8 px-3 py-2 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <svg className="w-3 h-3 text-warning flex-shrink-0 animate-pulse" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="10"/>
            </svg>
            <span className="text-[11px] font-semibold text-warning">Approve in your browser</span>
          </div>
          <p className="text-[10px] text-text-muted leading-relaxed">
            A browser window should have opened. Approve the login request to continue.
          </p>
          {ssoLogin.verificationUrl && (
            <button
              onClick={e => { e.stopPropagation(); api.openExternalUrl(ssoLogin.verificationUrl!).catch(() => {}) }}
              className="text-[10px] text-warning underline hover:text-warning/80 transition-colors"
            >
              Open browser again →
            </button>
          )}
        </div>
      )}

      {/* SSO error banner */}
      {ssoLogin?.status === 'error' && (
        <div className="mx-3 mb-2 rounded-lg border border-danger/40 bg-danger/8 px-3 py-2 space-y-1.5">
          <p className="text-[11px] font-semibold text-danger">Login failed</p>
          <p className="text-[10px] text-text-muted">{ssoLogin.error ?? 'SSO authentication failed. Try again.'}</p>
        </div>
      )}

      {/* Expired banner — only when not in SSO flow */}
      {expired && !ssoLogin && (
        <div className="mx-3 mb-2 rounded-lg border border-danger/30 bg-danger/6 px-3 py-2 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <svg className="w-3 h-3 text-danger flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span className="text-[11px] font-semibold text-danger">Session expired</span>
          </div>
          <p className="text-[10px] text-text-muted leading-relaxed">
            Click <strong className="text-text-secondary">Renew</strong> — your browser will open to approve the login.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-1 px-3 pb-3 pt-1 border-t border-border-subtle">
        {!active ? (
          <Button
            variant="primary" size="sm"
            loading={isStarting || ssoLogin?.status === 'polling'}
            className="flex-1 py-1 text-[11px]"
            onClick={e => { e.stopPropagation(); onStart() }}
          >
            {ssoLogin?.status === 'polling' ? 'Waiting for browser…' : ssoLogin?.status === 'starting' ? 'Opening browser…' : expired ? '🔄 Renew session' : 'Start session'}
          </Button>
        ) : (
          <>
            <Button
              variant="secondary" size="sm"
              loading={isRenewing || ssoLogin?.status === 'polling'}
              className="flex-1 py-1 text-[11px]"
              onClick={e => { e.stopPropagation(); onRenew() }}
              title="Renew — re-request credentials"
            >
              {ssoLogin?.status === 'polling' ? 'Waiting for browser…' : 'Renew'}
            </Button>
            <IconButton
              onClick={e => { e.stopPropagation(); onStop() }}
              title="Stop session — clears local credentials"
            >
              <svg className="w-3.5 h-3.5 text-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
              </svg>
            </IconButton>
            <IconButton
              onClick={e => { e.stopPropagation(); onConsole() }}
              title="Open AWS Console"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </IconButton>
            <IconButton
              onClick={e => { e.stopPropagation(); onCopyCreds() }}
              title="Copy credentials (export AWS_ACCESS_KEY_ID=...)"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2"/>
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg>
            </IconButton>
            <IconButton
              onClick={e => { e.stopPropagation(); onDetect() }}
              disabled={isDetecting}
              title="Detect EKS clusters"
            >
              {isDetecting ? (
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 11-6.22-8.56"/>
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>
                </svg>
              )}
            </IconButton>
          </>
        )}
      </div>

      {/* Cluster peek when detected */}
      {active && session && session.clusters && session.clusters.length > 0 && (
        <div className="px-3 pb-3">
          <p className="text-[9px] text-text-muted uppercase tracking-wider mb-1">
            {session.clusters.length} cluster{session.clusters.length !== 1 ? 's' : ''}
          </p>
          <div className="flex flex-wrap gap-1">
            {session.clusters.slice(0, 3).map(c => (
              <span key={c.name} className="text-[10px] font-mono bg-bg-surface border border-border-subtle rounded px-1.5 py-0.5 text-text-secondary truncate max-w-[120px]">
                {c.name}
              </span>
            ))}
            {session.clusters.length > 3 && (
              <span className="text-[10px] text-text-muted">+{session.clusters.length - 3}</span>
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}

function IconButton({ onClick, title, children, disabled }: {
  onClick: (e: React.MouseEvent) => void
  title: string
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-surface border border-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
type Tab = 'active' | 'favorites' | 'recent'

export function Orbit({
  sessions, ssoGroups, isLoading, selectedSession, activity,
  favorites, envOverrides,
  onSelectSession, onStartSession, onRenewSession, onStopSession, onSetDefault, onOpenConsole,
  onDetectClusters, onToggleFavorite, onAddConnection, onNavigate,
  updateInfo, onUpdateClick, onDismissUpdate, ssoLoginState = {},
}: OrbitProps) {
  const [tab, setTab] = useState<Tab>('active')
  const [starting, setStarting] = useState<string | null>(null)
  const [renewing, setRenewing] = useState<string | null>(null)
  const [stopping, setStopping] = useState<string | null>(null)
  const [detecting, setDetecting] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Live clock — drives countdowns so timeline + cards tick every 15s.
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const h = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(h)
  }, [])

  // Build a canonical list of RoleCardInput entries (one per account×role
  // across every SSO), merged with sessions when one exists.
  const allCards: RoleCardInput[] = useMemo(() => {
    const out: RoleCardInput[] = []
    const seen = new Set<string>()

    const addFromProfile = (profile: Profile, session: Session | null) => {
      if (!profile.accountId || !profile.roleName) return
      const key = `${profile.accountId}-${profile.roleName}`
      if (seen.has(key)) return
      seen.add(key)
      const accountName = profile.accountName ?? profile.name.split(' / ')[0] ?? profile.name
      const overrideKey = envOverrideKey(profile.startUrl, profile.accountId)
      const env = envOverrides[overrideKey] ?? detectEnv(accountName)
      out.push({
        profile,
        accountName,
        session,
        env,
        envOverridden: overrideKey in envOverrides,
        favorite: favorites.has(favKey(profile.startUrl, profile.accountId, profile.roleName)),
      })
    }

    // Active sessions first
    for (const s of sessions) {
      addFromProfile({
        name: s.accountName,
        accountName: s.accountName,
        startUrl: s.startUrl,
        ssoRegion: s.ssoRegion,
        accountId: s.accountId,
        roleName: s.roleName,
        region: s.region,
      }, s)
    }

    // Then idle profiles
    for (const group of ssoGroups) {
      for (const p of group.profiles) addFromProfile(p, null)
    }

    return out
  }, [sessions, ssoGroups, favorites, envOverrides])

  // Stats
  const stats = useMemo(() => {
    const activeSessions = sessions.filter(s => new Date(s.expiresAt).getTime() > now)
    const expiring = activeSessions.filter(s => new Date(s.expiresAt).getTime() - now <= 15 * 60000)
    const totalRoles = allCards.length
    const totalAccounts = new Set(allCards.map(c => c.profile.accountId)).size
    return {
      connections: ssoGroups.length,
      accounts: totalAccounts,
      roles: totalRoles,
      active: activeSessions.length,
      expiring: expiring.length,
      favorites: allCards.filter(c => c.favorite).length,
    }
  }, [sessions, ssoGroups, allCards, now])

  // Tab selection
  const cardsForTab = useMemo(() => {
    if (tab === 'active') {
      return allCards
        .filter(c => c.session && new Date(c.session.expiresAt).getTime() > now)
        .sort((a, b) => new Date(a.session!.expiresAt).getTime() - new Date(b.session!.expiresAt).getTime())
    }
    if (tab === 'favorites') {
      return allCards.filter(c => c.favorite).sort((a, b) => a.accountName.localeCompare(b.accountName))
    }
    // recent — sessions in the activity log with type=session-start or -renew
    const refOrder = new Map<string, number>()
    activity.forEach((ev, i) => {
      if (ev.type !== 'session-start' && ev.type !== 'session-renew') return
      if (!refOrder.has(ev.reference)) refOrder.set(ev.reference, i)
    })
    return allCards
      .filter(c => c.session)
      .sort((a, b) => {
        const ra = refOrder.get(`${a.accountName} / ${a.profile.roleName}`) ?? 999
        const rb = refOrder.get(`${b.accountName} / ${b.profile.roleName}`) ?? 999
        return ra - rb
      })
      .slice(0, 12)
  }, [allCards, tab, now, activity])

  // ── Action handlers ────────────────────────────────────────────────────
  const handleStart = async (profile: Profile) => {
    const key = `${profile.accountId}-${profile.roleName}`
    setStarting(key); setActionError(null)
    try { await onStartSession(profile) }
    catch (e) { setActionError(String(e)) }
    finally { setStarting(null) }
  }
  const handleRenew = async (session: Session) => {
    setRenewing(session.id); setActionError(null)
    try { await onRenewSession(session) }
    catch (e) { setActionError(String(e)) }
    finally { setRenewing(null) }
  }
  const handleStop = async (session: Session) => {
    setStopping(session.id); setActionError(null)
    try { await onStopSession(session) }
    catch (e) { setActionError(String(e)) }
    finally { setStopping(null) }
  }
  const handleDefault = async (session: Session) => {
    try { await onSetDefault(session) }
    catch (e) { setActionError(String(e)) }
  }
  const handleConsole = async (session: Session) => {
    try { await onOpenConsole(session) } catch (e) { setActionError(String(e)) }
  }
  const handleCopyCreds = async (session: Session) => {
    const text =
      `export AWS_ACCESS_KEY_ID=${session.accessKeyId}\n` +
      `export AWS_SECRET_ACCESS_KEY=${session.secretAccessKey}\n` +
      `export AWS_SESSION_TOKEN=${session.sessionToken}\n` +
      `export AWS_DEFAULT_REGION=${session.region}\n`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(session.id)
      setTimeout(() => setCopied(c => c === session.id ? null : c), 1800)
    } catch (e) { setActionError(String(e)) }
  }
  const handleDetect = async (session: Session) => {
    if (!onDetectClusters) return
    setDetecting(session.id); setActionError(null)
    try { await onDetectClusters(session) }
    catch (e) { setActionError(String(e)) }
    finally { setDetecting(null) }
  }

  // Empty state when zero connections
  if (!isLoading && ssoGroups.length === 0) {
    return (
      <div className="h-full overflow-y-auto">
        <EmptyState
          variant="wave"
          title="Welcome to CloudOrbit"
          description="Your cloud access control center. Connect your first cloud account to start managing sessions, roles, and clusters — all in one place."
          action={onAddConnection ? { label: '+ Add Connection', onClick: onAddConnection } : undefined}
          secondaryAction={onNavigate ? { label: 'See how it works', onClick: () => onNavigate('docs') } : undefined}
        />
      </div>
    )
  }

  const tabCount = tab === 'active' ? stats.active : tab === 'favorites' ? stats.favorites : cardsForTab.length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle flex-shrink-0">
        <div>
          <h1 className="font-display font-bold text-text-primary text-base">Overview</h1>
          <p className="text-text-muted text-xs mt-0.5">Your cloud access at a glance.</p>
        </div>
        <div className="flex items-center gap-2">
          {onAddConnection && (
            <Button variant="ghost" size="sm" onClick={onAddConnection}>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Connection
            </Button>
          )}
          {onNavigate && (
            <Button variant="secondary" size="sm" onClick={() => onNavigate('accounts')}>
              Manage Accounts →
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* News / update banner */}
        <AnimatePresence>
          {updateInfo && (
            <motion.div
              data-testid="update-banner"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-3 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/25 rounded-xl px-4 py-3"
            >
              <svg className="w-4 h-4 text-primary flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
              </svg>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-text-primary">Update available</span>
                  <span className="text-[10px] font-mono bg-primary/15 text-primary border border-primary/20 rounded px-1.5 py-0.5 font-semibold">
                    v{updateInfo.version}
                  </span>
                </div>
                <p className="text-text-muted text-[10px] mt-0.5">
                  We ship frequently — this is an early release with constant improvements
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={onDismissUpdate}
                  className="text-text-muted text-[11px] hover:text-text-primary transition-colors px-1"
                >
                  Later
                </button>
                <button
                  onClick={onUpdateClick}
                  className="text-[11px] font-semibold bg-primary text-bg-base hover:bg-primary/90 transition-colors rounded-lg px-3 py-1.5"
                >
                  Update Now
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stat band */}
        <div className="flex gap-3">
          <StatTile label="Connections" value={stats.connections} tone="text-text-primary" onClick={onNavigate ? () => onNavigate('accounts') : undefined} />
          <StatTile label="Accounts"    value={stats.accounts}    tone="text-text-primary" onClick={onNavigate ? () => onNavigate('accounts') : undefined} />
          <StatTile label="Active"      value={stats.active}      tone="text-success"      onClick={() => setTab('active')} />
          <StatTile label="Expiring"    value={stats.expiring}    tone={stats.expiring > 0 ? 'text-warning' : 'text-text-muted'} onClick={() => setTab('active')} />
          <StatTile label="★ Favorites" value={stats.favorites}   tone="text-warning"      onClick={() => setTab('favorites')} />
        </div>

        {/* Timeline chart */}
        <SessionTimeline sessions={sessions} now={now} />

        {/* Error banner */}
        {actionError && (
          <div className="bg-danger/10 border border-danger/30 rounded-lg px-3 py-2 flex items-start gap-2">
            <svg className="w-3.5 h-3.5 text-danger flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <pre className="text-danger/90 text-[11px] whitespace-pre-wrap break-words font-mono leading-relaxed flex-1 min-w-0">{actionError}</pre>
            <button onClick={() => setActionError(null)} className="text-danger/70 hover:text-danger text-[11px] flex-shrink-0">Dismiss</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-0 border-b border-border-subtle">
          {(['active', 'favorites', 'recent'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors capitalize ${
                tab === t
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              {t}
              <span className={`px-1 py-0.5 rounded text-[10px] font-mono ${
                tab === t ? 'bg-primary/20 text-primary' : 'bg-bg-surface text-text-muted'
              }`}>
                {t === 'active' ? stats.active : t === 'favorites' ? stats.favorites : tabCount}
              </span>
            </button>
          ))}
        </div>

        {/* Card grid */}
        {cardsForTab.length === 0 ? (
          <EmptyState
            variant={tab === 'favorites' ? 'wave' : 'sleep'}
            title={
              tab === 'active'    ? 'No active sessions' :
              tab === 'favorites' ? 'No favorites yet' :
                                    'Nothing recent yet'
            }
            description={
              tab === 'active'    ? 'Start a session from the Favorites tab or the Accounts screen.' :
              tab === 'favorites' ? 'Star the roles you use most from the Accounts screen and they will pin here.' :
                                    'Sessions you start will show up here so you can jump back quickly.'
            }
            action={tab === 'favorites' && onNavigate ? { label: 'Open Accounts', onClick: () => onNavigate('accounts') } : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <AnimatePresence initial={false}>
              {cardsForTab.map(card => {
                const key = `${card.profile.accountId}-${card.profile.roleName}`
                return (
                  <RoleCard
                    key={key}
                    input={card}
                    isStarting={starting === key}
                    isRenewing={card.session ? renewing === card.session.id : false}
                    isDetecting={card.session ? detecting === card.session.id : false}
                    ssoLogin={ssoLoginState[key]}
                    onStart={() => handleStart(card.profile)}
                    onRenew={() => card.session && handleRenew(card.session)}
                    onStop={() => card.session && handleStop(card.session)}
                    onSetDefault={() => card.session && handleDefault(card.session)}
                    onConsole={() => card.session && handleConsole(card.session)}
                    onCopyCreds={() => card.session && handleCopyCreds(card.session)}
                    onDetect={() => card.session && handleDetect(card.session)}
                    onSelect={() => card.session && onSelectSession(card.session)}
                    onToggleFavorite={() => {
                      if (card.profile.accountId && card.profile.roleName) {
                        onToggleFavorite(favKey(card.profile.startUrl, card.profile.accountId, card.profile.roleName))
                      }
                    }}
                  />
                )
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Copy-creds toast — lives briefly at bottom of grid */}
        <AnimatePresence>
          {copied && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-success/15 border border-success/40 text-success text-xs font-medium px-3 py-1.5 rounded-full"
            >
              Credentials copied to clipboard
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default Orbit
