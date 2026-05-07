import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Session } from '@/types'
import { formatExpiry } from '@/lib/time'
import { EnvBadge, MethodChip, StatusChip } from '@/components/ui/Badge'
import { StatusDot } from '@/components/ui/StatusDot'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { SkeletonRow } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'

type TabType = 'all' | 'active' | 'expiring' | 'expired'

interface SessionsProps {
  sessions: Session[]
  isLoading: boolean
  selectedSession: Session | null
  onSelectSession: (session: Session) => void
  onOpenConsole: (session: Session) => void
  onRenewSession: (session: Session) => void
}

export function Sessions({ sessions, isLoading, selectedSession, onSelectSession, onOpenConsole, onRenewSession }: SessionsProps) {
  const [tab, setTab] = useState<TabType>('all')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const filtered = sessions.filter(s => {
    const now = Date.now()
    const exp = new Date(s.expiresAt).getTime()
    const diffMs = exp - now
    const matchesTab =
      tab === 'all' ? true :
      tab === 'active' ? diffMs > 30 * 60000 :
      tab === 'expiring' ? diffMs > 0 && diffMs <= 30 * 60000 :
      tab === 'expired' ? diffMs <= 0 :
      true
    const q = search.toLowerCase()
    const matchesSearch = !q || s.accountName.toLowerCase().includes(q) || s.roleName.toLowerCase().includes(q) || s.accountId.includes(q)
    return matchesTab && matchesSearch
  })

  const tabCounts: Record<TabType, number> = {
    all: sessions.length,
    active: sessions.filter(s => (new Date(s.expiresAt).getTime() - Date.now()) > 30 * 60000).length,
    expiring: sessions.filter(s => { const d = new Date(s.expiresAt).getTime() - Date.now(); return d > 0 && d <= 30 * 60000 }).length,
    expired: sessions.filter(s => new Date(s.expiresAt).getTime() <= Date.now()).length,
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  const handleRenewAll = () => {
    sessions
      .filter(s => new Date(s.expiresAt).getTime() > Date.now())
      .forEach(s => onRenewSession(s))
  }

  const handleRenewSelected = () => {
    filtered.filter(s => selectedIds.has(s.id)).forEach(s => onRenewSession(s))
    setSelectedIds(new Set())
  }

  const selectionCount = selectedIds.size

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle flex-shrink-0">
        <div>
          <h1 className="font-display font-bold text-text-primary text-base">Sessions</h1>
          <p className="text-text-muted text-xs mt-0.5">
            {sessions.length} credential{sessions.length !== 1 ? 's' : ''} · Monitor and renew short-lived access
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search sessions..."
              className="bg-bg-surface border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-text-primary placeholder-text-muted outline-none focus:border-border-focus w-44 transition-colors"
            />
          </div>
          <Button variant="ghost" size="sm" onClick={handleRenewAll} disabled={sessions.filter(s => new Date(s.expiresAt).getTime() > Date.now()).length === 0}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
            Renew All
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 px-5 border-b border-border-subtle flex-shrink-0">
        {(['all', 'active', 'expiring', 'expired'] as TabType[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors capitalize ${
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {t}
            <span className={`px-1 py-0.5 rounded text-[10px] ${
              tab === t ? 'bg-primary/20 text-primary' : 'bg-bg-surface text-text-muted'
            }`}>{tabCounts[t]}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto relative">
        {isLoading ? (
          <div>{Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            variant="sleep"
            title="No sessions here"
            description={tab !== 'all' ? 'No sessions match this filter.' : 'Start a session from the Orbit view.'}
          />
        ) : (
          <div>
            {/* Table header */}
            <div className="grid px-4 py-2 text-[10px] font-semibold text-text-muted uppercase tracking-wider border-b border-border-subtle sticky top-0 bg-bg-base z-10"
              style={{ gridTemplateColumns: '36px 1fr 90px 80px 70px 120px 80px' }}>
              <div />
              <div>Account / Role</div>
              <div>Account ID</div>
              <div>Region</div>
              <div>Method</div>
              <div>Time Remaining</div>
              <div>Status</div>
            </div>

            <AnimatePresence initial={false}>
              {filtered.map((session, i) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  index={i}
                  isSelected={selectedSession?.id === session.id}
                  isChecked={selectedIds.has(session.id)}
                  onSelect={onSelectSession}
                  onConsole={onOpenConsole}
                  onRenew={onRenewSession}
                  onToggleCheck={() => toggleSelect(session.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Floating bulk action bar */}
        <AnimatePresence>
          {selectionCount > 0 && (
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 340, damping: 28 }}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20"
            >
              <div className="flex items-center gap-3 bg-bg-elevated border border-border rounded-xl px-4 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] whitespace-nowrap">
                <span className="text-text-secondary text-xs font-medium">
                  {selectionCount} selected
                </span>
                <div className="w-px h-4 bg-border" />
                <button
                  onClick={handleRenewSelected}
                  className="flex items-center gap-1.5 text-xs text-text-primary hover:text-success transition-colors font-medium"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="23 4 23 10 17 10"/>
                    <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
                  </svg>
                  Renew Selected
                </button>
                <div className="w-px h-4 bg-border" />
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                  Clear
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function SessionRow({ session: s, index, isSelected, isChecked, onSelect, onConsole, onRenew, onToggleCheck }: {
  session: Session
  index: number
  isSelected: boolean
  isChecked: boolean
  onSelect: (s: Session) => void
  onConsole: (s: Session) => void
  onRenew: (s: Session) => void
  onToggleCheck: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const { label, status } = formatExpiry(s.expiresAt)
  const sessionStatus = status === 'expired' ? 'expired' : status === 'expiring' ? 'expiring' : 'active'

  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, delay: index * 0.02 }}
      className={`grid items-center px-4 py-3 border-b border-border-subtle cursor-pointer transition-colors ${
        isChecked ? 'bg-primary/5 border-l-2 border-l-primary' :
        isSelected ? 'bg-bg-surface2' : hovered ? 'bg-bg-surface' : ''
      }`}
      style={{ gridTemplateColumns: '36px 1fr 90px 80px 70px 120px 80px' }}
      onClick={() => onSelect(s)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Checkbox / status indicator */}
      <div
        className="flex items-center cursor-pointer"
        onClick={e => { e.stopPropagation(); onToggleCheck() }}
      >
        {hovered || isChecked ? (
          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
            isChecked ? 'bg-primary border-primary' : 'border-border hover:border-primary'
          }`}>
            {isChecked && (
              <svg className="w-2.5 h-2.5 text-bg-base" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            )}
          </div>
        ) : (
          <StatusDot status={sessionStatus} size="sm" />
        )}
      </div>

      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex items-center gap-1.5">
          <EnvBadge env={s.environment} />
          <span className="text-text-primary text-xs font-medium truncate">{s.accountName}</span>
        </div>
        <span className="text-text-muted text-[11px] truncate">{s.roleName}</span>
      </div>
      <div className="font-mono text-text-muted text-xs">{s.accountId.slice(-6)}</div>
      <div className="font-mono text-text-muted text-xs">{s.region}</div>
      <div><MethodChip method={s.method} /></div>
      <div className="flex flex-col gap-1 pr-2">
        <span className={`text-xs font-mono ${
          status === 'expired' ? 'text-danger' :
          status === 'expiring' ? 'text-warning' : 'text-text-secondary'
        }`}>{label}</span>
        <ProgressBar expiresAt={s.expiresAt} />
      </div>
      <div className="flex items-center gap-1">
        <StatusChip status={sessionStatus} />
        {hovered && (
          <div className="flex items-center gap-0.5 ml-auto">
            <button
              onClick={e => { e.stopPropagation(); onConsole(s) }}
              className="p-1 rounded text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
              title="Open console"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </button>
            <button
              onClick={e => { e.stopPropagation(); onRenew(s) }}
              className="p-1 rounded text-text-muted hover:text-success hover:bg-success/10 transition-colors"
              title="Renew session"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
              </svg>
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default Sessions
