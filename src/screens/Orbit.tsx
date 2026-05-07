import React, { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Session, SsoGroup, Profile, Screen } from '@/types'
import { formatExpiry, detectEnv } from '@/lib/time'
import { EnvBadge, MethodChip, StatusChip } from '@/components/ui/Badge'
import { StatusDot } from '@/components/ui/StatusDot'
import { SkeletonRow } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'

type FilterType = 'all' | 'active' | 'expiring' | 'favorites'

interface OrbitProps {
  sessions: Session[]
  ssoGroups: SsoGroup[]
  isLoading: boolean
  onSelectSession: (session: Session) => void
  onStartSession: (profile: Profile) => Promise<void>
  selectedSession: Session | null
  onAddConnection?: () => void
  onNavigate?: (screen: Screen) => void
}

interface SsoLoginState {
  status: 'idle' | 'starting' | 'waiting' | 'polling' | 'done' | 'error'
  clientId?: string
  clientSecret?: string
  deviceCode?: string
  verificationUri?: string
  error?: string
  interval?: number
}

interface RowProfile {
  type: 'session'
  session: Session
}

interface RowIdle {
  type: 'idle'
  profile: Profile
}

type Row = RowProfile | RowIdle

function maskAccountId(id: string): string {
  if (id.length <= 4) return id
  return `••••${id.slice(-4)}`
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <motion.div
      className="bg-bg-elevated border border-border rounded-xl px-4 py-3 flex items-center justify-between"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <span className="text-text-secondary text-xs">{label}</span>
      <span className={`text-2xl font-display font-bold ${color}`}>{value}</span>
    </motion.div>
  )
}

export function Orbit({ sessions, ssoGroups, isLoading, onSelectSession, onStartSession, selectedSession, onAddConnection, onNavigate }: OrbitProps) {
  const [filter, setFilter] = useState<FilterType>('all')
  const [loginModal, setLoginModal] = useState<{ profile: Profile; state: SsoLoginState } | null>(null)
  const [startingProfile, setStartingProfile] = useState<string | null>(null)
  const [supportBannerDismissed, setSupportBannerDismissed] = useState(
    () => localStorage.getItem('cloudorbit:support-banner-dismissed') === '1'
  )

  const dismissSupportBanner = useCallback(() => {
    localStorage.setItem('cloudorbit:support-banner-dismissed', '1')
    setSupportBannerDismissed(true)
  }, [])

  // Build rows: active sessions + idle profiles (profiles with no active session)
  const rows: Row[] = React.useMemo(() => {
    const allRows: Row[] = sessions.map(s => ({ type: 'session', session: s }))
    // Add idle profiles not covered by active sessions
    for (const group of ssoGroups) {
      for (const profile of group.profiles) {
        if (!profile.accountId || !profile.roleName) continue
        const hasSession = sessions.some(
          s => s.accountId === profile.accountId && s.roleName === profile.roleName
        )
        if (!hasSession) {
          allRows.push({ type: 'idle', profile })
        }
      }
    }
    return allRows
  }, [sessions, ssoGroups])

  const filtered = React.useMemo(() => {
    return rows.filter(row => {
      if (filter === 'all') return true
      if (filter === 'favorites') {
        return row.type === 'session' && row.session.isFavorite
      }
      if (filter === 'active') {
        if (row.type === 'idle') return false
        const diffMs = new Date(row.session.expiresAt).getTime() - Date.now()
        return diffMs > 30 * 60000
      }
      if (filter === 'expiring') {
        if (row.type === 'idle') return false
        const diffMs = new Date(row.session.expiresAt).getTime() - Date.now()
        return diffMs > 0 && diffMs <= 30 * 60000
      }
      return true
    })
  }, [rows, filter])

  const stats = React.useMemo(() => {
    const now = Date.now()
    const active = sessions.filter(s => new Date(s.expiresAt).getTime() > now).length
    const expiring = sessions.filter(s => {
      const diff = new Date(s.expiresAt).getTime() - now
      return diff > 0 && diff <= 30 * 60000
    }).length
    const favorites = sessions.filter(s => s.isFavorite).length
    const clusters = sessions.reduce((acc, s) => acc + (s.clusters?.length ?? 0), 0)
    return { active, expiring, favorites, clusters }
  }, [sessions])

  const handleRowClick = useCallback((row: Row) => {
    if (row.type === 'session') {
      onSelectSession(row.session)
    } else {
      handleStartProfile(row.profile)
    }
  }, [onSelectSession])

  const handleStartProfile = useCallback(async (profile: Profile) => {
    const key = `${profile.accountId}-${profile.roleName}`
    setStartingProfile(key)
    try {
      await onStartSession(profile)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      // If "Not logged in" — show SSO modal
      if (msg.includes('Not logged in') || msg.includes('not-in-tauri')) {
        setLoginModal({
          profile,
          state: { status: 'starting' },
        })
      }
    } finally {
      setStartingProfile(null)
    }
  }, [onStartSession])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle flex-shrink-0">
        <div>
          <h1 className="font-display font-bold text-text-primary text-base">Orbit Overview</h1>
          <p className="text-text-muted text-xs mt-0.5">
            {rows.length} profile{rows.length !== 1 ? 's' : ''} · {sessions.length} session{sessions.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
            Refresh
          </Button>
          <Button variant="primary" size="sm">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Session
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3 px-5 py-3 flex-shrink-0">
        <StatCard label="Active Sessions" value={stats.active} color="text-success" />
        <StatCard label="Expiring Soon" value={stats.expiring} color="text-warning" />
        <StatCard label="Favorites" value={stats.favorites} color="text-primary" />
        <StatCard label="Clusters" value={stats.clusters} color="text-info" />
      </div>

      {/* Support banner */}
      <AnimatePresence>
        {!supportBannerDismissed && sessions.length > 0 && (
          <motion.div
            className="mx-5 mb-2 flex-shrink-0"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-rose-500/8 border border-rose-500/20">
              <svg className="w-4 h-4 text-rose-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
              <p className="flex-1 text-xs text-text-secondary">
                CloudOrbit is free &amp; open source.{' '}
                <button
                  className="text-rose-400 font-medium hover:underline"
                  onClick={() => onNavigate?.('support')}
                >
                  Support the project →
                </button>
              </p>
              <button
                onClick={dismissSupportBanner}
                className="text-text-muted hover:text-text-secondary transition-colors flex-shrink-0"
                aria-label="Dismiss"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter chips */}
      <div className="flex items-center gap-1.5 px-5 pb-2 flex-shrink-0">
        {(['all', 'active', 'expiring', 'favorites'] as FilterType[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize ${
              filter === f
                ? 'bg-primary text-bg-base'
                : 'bg-bg-surface text-text-secondary hover:text-text-primary hover:bg-bg-surface2 border border-border'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div>{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}</div>
        ) : filtered.length === 0 && ssoGroups.length === 0 ? (
          <FirstLaunchState onAddConnection={onAddConnection} />
        ) : filtered.length === 0 ? (
          <EmptyState
            variant="search"
            title="No matching accounts"
            description="Try changing the filter above."
          />
        ) : (
          <>
            {/* Table header */}
            <div className="grid px-4 py-2 text-[10px] font-semibold text-text-muted uppercase tracking-wider border-b border-border-subtle sticky top-0 bg-bg-base z-10"
              style={{ gridTemplateColumns: '28px 1fr 100px 100px 80px 70px 50px 90px 80px' }}>
              <div />
              <div>Account</div>
              <div>Account ID</div>
              <div>Role</div>
              <div>Region</div>
              <div>Method</div>
              <div>EKS</div>
              <div>Expires</div>
              <div>Status</div>
            </div>

            {/* Rows */}
            <AnimatePresence initial={false}>
              {filtered.map((row, i) => (
                <OrbitRow
                  key={row.type === 'session' ? row.session.id : `idle-${row.profile.accountId}-${row.profile.roleName}`}
                  row={row}
                  index={i}
                  isSelected={row.type === 'session' && selectedSession?.id === row.session.id}
                  isStarting={row.type === 'idle' && startingProfile === `${row.profile.accountId}-${row.profile.roleName}`}
                  onClick={() => handleRowClick(row)}
                />
              ))}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* SSO Login Modal */}
      <SsoLoginModal
        modal={loginModal}
        onClose={() => setLoginModal(null)}
        onLoginDone={() => {
          setLoginModal(null)
          if (loginModal) handleStartProfile(loginModal.profile)
        }}
      />
    </div>
  )
}

function OrbitRow({ row, index, isSelected, isStarting, onClick }: {
  row: Row
  index: number
  isSelected: boolean
  isStarting: boolean
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)

  if (row.type === 'session') {
    const s = row.session
    const { label: expiryLabel, status: expiryStatus } = formatExpiry(s.expiresAt)
    const sessionStatus = expiryStatus === 'expired' ? 'expired' : expiryStatus === 'expiring' ? 'expiring' : 'active'
    const clusterCount = s.clusters?.length ?? 0

    return (
      <motion.div
        initial={{ opacity: 0, x: -4 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -4 }}
        transition={{ duration: 0.15, delay: index * 0.02 }}
        className={`grid items-center px-4 py-2.5 border-b border-border-subtle cursor-pointer transition-colors group ${
          isSelected ? 'bg-bg-surface2' : hovered ? 'bg-bg-surface' : ''
        }`}
        style={{ gridTemplateColumns: '28px 1fr 100px 100px 80px 70px 50px 90px 80px' }}
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="flex items-center">
          <StatusDot status={sessionStatus} size="sm" />
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <EnvBadge env={s.environment} />
          <span className="text-text-primary text-xs font-medium truncate">{s.accountName}</span>
          {s.isFavorite && (
            <svg className="w-3 h-3 text-warning flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          )}
        </div>
        <div className="font-mono text-text-muted text-xs">{maskAccountId(s.accountId)}</div>
        <div className="text-text-secondary text-xs truncate">{s.roleName}</div>
        <div className="font-mono text-text-muted text-xs">{s.region}</div>
        <div><MethodChip method={s.method} /></div>
        <div className="text-text-secondary text-xs">
          {clusterCount > 0 ? (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
              </svg>
              {clusterCount}
            </span>
          ) : (
            <span className="text-text-muted">—</span>
          )}
        </div>
        <div className={`font-mono text-xs ${
          expiryStatus === 'expired' ? 'text-danger' :
          expiryStatus === 'expiring' ? 'text-warning' : 'text-text-secondary'
        }`}>{expiryLabel}</div>
        <div className="flex items-center justify-between">
          <StatusChip status={sessionStatus} />
          {hovered && (
            <div className="flex items-center gap-1 ml-1">
              <button
                onClick={e => { e.stopPropagation(); onClick() }}
                className="p-0.5 rounded text-text-muted hover:text-primary transition-colors"
                title="View details"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                </svg>
              </button>
            </div>
          )}
        </div>
      </motion.div>
    )
  }

  // Idle profile row
  const p = row.profile
  const env = detectEnv(p.name)
  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -4 }}
      transition={{ duration: 0.15, delay: index * 0.02 }}
      className={`grid items-center px-4 py-2.5 border-b border-border-subtle cursor-pointer transition-colors group ${
        hovered ? 'bg-bg-surface' : ''
      }`}
      style={{ gridTemplateColumns: '28px 1fr 100px 100px 80px 70px 50px 90px 80px' }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center">
        <StatusDot status="idle" size="sm" />
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <EnvBadge env={env} />
        <span className="text-text-secondary text-xs font-medium truncate">{p.name || p.accountId || 'Unknown'}</span>
      </div>
      <div className="font-mono text-text-muted text-xs">{p.accountId ? maskAccountId(p.accountId) : '—'}</div>
      <div className="text-text-muted text-xs truncate">{p.roleName ?? '—'}</div>
      <div className="font-mono text-text-muted text-xs">{p.region}</div>
      <div><MethodChip method="sso" /></div>
      <div className="text-text-muted text-xs">—</div>
      <div className="text-text-muted text-xs">—</div>
      <div className="flex items-center justify-between">
        <StatusChip status="idle" />
        {hovered && (
          <Button
            variant="secondary"
            size="sm"
            loading={isStarting}
            className="ml-1 py-0.5 px-1.5 text-[10px]"
            onClick={e => { e.stopPropagation(); onClick() }}
          >
            Start
          </Button>
        )}
      </div>
    </motion.div>
  )
}

// ── First Launch State ─────────────────────────────────────────────────────────

function FirstLaunchState({ onAddConnection }: { onAddConnection?: () => void }) {
  const [logoFailed, setLogoFailed] = useState(false)

  return (
    <motion.div
      className="flex flex-col items-center justify-center py-12 px-8 text-center h-full"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Logo / mascot */}
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="mb-4"
      >
        {logoFailed ? (
          <div className="w-28 h-28 rounded-2xl bg-bg-surface border border-border flex items-center justify-center">
            <svg className="w-12 h-12 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>
              <ellipse cx="12" cy="12" rx="10" ry="4.5" strokeDasharray="3 2"/>
            </svg>
          </div>
        ) : (
          <img
            src="/images/logo-cloudorbit.PNG"
            alt="CloudOrbit"
            className="w-32 h-auto object-contain drop-shadow-2xl"
            onError={() => setLogoFailed(true)}
          />
        )}
      </motion.div>

      <h2 className="font-display font-bold text-text-primary text-xl mb-2">Welcome to CloudOrbit</h2>
      <p className="text-text-secondary text-sm max-w-sm leading-relaxed mb-6">
        Your cloud access control center. Connect your first cloud account to start managing sessions, roles, and clusters — all in one place.
      </p>

      {/* Action buttons */}
      <div className="flex items-center gap-3 mb-8">
        {onAddConnection && (
          <Button variant="primary" size="sm" onClick={onAddConnection}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Connection
          </Button>
        )}
        <Button variant="ghost" size="sm">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
          </svg>
          View Docs
        </Button>
      </div>

      {/* Supported platforms */}
      <div className="w-full max-w-xs">
        <p className="text-text-muted text-[10px] font-semibold uppercase tracking-wider mb-3">Supported platforms</p>
        <div className="grid grid-cols-3 gap-2">
          {/* AWS — active */}
          <div className="flex flex-col items-center gap-2 p-3 bg-bg-surface border border-border rounded-xl">
            <svg viewBox="0 0 48 48" className="w-7 h-7" fill="none">
              <path d="M14 28c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-8H14v8z" fill="#FF9900"/>
              <path d="M14 20c0-1.1.9-2 2-2h14v4H14v-2z" fill="#FF9900"/>
              <path d="M9 34c5.5 2.5 12.5 3.8 15 3.8s9.5-1.3 15-3.8" stroke="#FF9900" strokeWidth="2" strokeLinecap="round" fill="none"/>
            </svg>
            <span className="text-[10px] font-medium text-text-primary">AWS</span>
            <span className="text-[9px] bg-success/15 text-success px-1.5 py-0.5 rounded-full font-medium">Supported</span>
          </div>
          {/* GCP — coming soon */}
          <div className="flex flex-col items-center gap-2 p-3 bg-bg-surface border border-border rounded-xl opacity-60">
            <svg viewBox="0 0 48 48" className="w-7 h-7" fill="none">
              <path d="M24 12l9 16H15L24 12z" fill="#EA4335" opacity="0.7"/>
              <path d="M33 28H15l-6 10h30L33 28z" fill="#4285F4" opacity="0.7"/>
              <path d="M24 12l9 16-6 10H21L15 28l9-16z" fill="#FBBC04" opacity="0.7"/>
            </svg>
            <span className="text-[10px] font-medium text-text-secondary">GCP</span>
            <span className="text-[9px] bg-bg-overlay text-text-muted px-1.5 py-0.5 rounded-full font-medium border border-border">Soon</span>
          </div>
          {/* Azure — coming soon */}
          <div className="flex flex-col items-center gap-2 p-3 bg-bg-surface border border-border rounded-xl opacity-60">
            <svg viewBox="0 0 48 48" className="w-7 h-7" fill="none">
              <path d="M22 10l-10 18 12 2-14 8h20L22 10z" fill="#0078D4" opacity="0.7"/>
            </svg>
            <span className="text-[10px] font-medium text-text-secondary">Azure</span>
            <span className="text-[9px] bg-bg-overlay text-text-muted px-1.5 py-0.5 rounded-full font-medium border border-border">Soon</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ── SSO Login Modal ────────────────────────────────────────────────────────────

interface SsoLoginModalProps {
  modal: { profile: Profile; state: SsoLoginState } | null
  onClose: () => void
  onLoginDone: () => void
}

function SsoLoginModal({ modal, onClose, onLoginDone }: SsoLoginModalProps) {
  const [copied, setCopied] = useState(false)
  const [status, setStatus] = useState<SsoLoginState>({ status: 'idle' })

  useEffect(() => {
    if (modal?.state.status === 'starting') {
      setStatus({ status: 'starting' })
    }
  }, [modal])

  useEffect(() => {
    if (!modal || status.status === 'idle') return
    if (status.status === 'starting') {
      // In real app, invoke sso_login_start here
      // For now, show a placeholder state
      setStatus({
        status: 'waiting',
        verificationUri: `https://${modal.profile.startUrl}`,
        deviceCode: 'mock-device-code',
        clientId: 'mock-client-id',
        clientSecret: 'mock-secret',
        interval: 5,
      })
    }
    if (status.status === 'waiting') {
      // Start polling
      setStatus(s => ({ ...s, status: 'polling' }))
    }
  }, [modal, status.status])

  if (!modal) return null

  const copy = () => {
    if (status.verificationUri) {
      navigator.clipboard.writeText(status.verificationUri)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Modal open={!!modal} onClose={onClose} title="SSO Login Required">
      <div className="space-y-4">
        <Callout variant="info">
          Your browser has been opened to complete the SSO login. Approve the request to continue.
        </Callout>

        {status.verificationUri && (
          <div>
            <p className="text-text-muted text-xs mb-1.5">Verification URL</p>
            <div className="flex items-center gap-2 bg-bg-surface rounded-lg px-3 py-2 border border-border">
              <span className="flex-1 font-mono text-xs text-text-secondary truncate">{status.verificationUri}</span>
              <button onClick={copy} className="text-text-muted hover:text-primary transition-colors flex-shrink-0">
                {copied ? (
                  <svg className="w-3.5 h-3.5 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2"/>
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2.5 py-2">
          {(status.status === 'polling' || status.status === 'waiting') && (
            <>
              <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin flex-shrink-0" />
              <span className="text-text-secondary text-sm">Waiting for browser login...</span>
            </>
          )}
          {status.status === 'starting' && (
            <>
              <div className="w-3.5 h-3.5 border-2 border-text-muted border-t-transparent rounded-full animate-spin flex-shrink-0" />
              <span className="text-text-muted text-sm">Starting SSO flow...</span>
            </>
          )}
          {status.status === 'done' && (
            <>
              <svg className="w-3.5 h-3.5 text-success flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
              <span className="text-success text-sm">Login successful!</span>
            </>
          )}
          {status.status === 'error' && (
            <span className="text-danger text-sm">{status.error ?? 'Login failed'}</span>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          {status.status === 'done' && (
            <Button variant="primary" size="sm" onClick={onLoginDone}>Continue</Button>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default Orbit
