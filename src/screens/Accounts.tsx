import React, { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Session, SsoGroup, Profile, ClusterInfo, EnvType, CustomTag } from '@/types'
import { EnvBadge, EnvEditableBadge, MethodChip, StatusChip } from '@/components/ui/Badge'
import { StatusDot } from '@/components/ui/StatusDot'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonRow } from '@/components/ui/Skeleton'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Toggle } from '@/components/ui/Toggle'
import Button from '@/components/ui/Button'
import { AddConnectionWizard } from '@/components/ui/AddConnectionWizard'
import { formatExpiry, detectEnv, envOverrideKey } from '@/lib/time'

type FilterType = 'all' | 'sso' | 'iam' | 'federated' | 'chained' | 'favorites'

interface AccountsProps {
  sessions: Session[]
  ssoGroups: SsoGroup[]
  isLoading: boolean
  selectedSession: Session | null
  onSelectSession: (s: Session) => void
  onStartSession: (p: Profile) => Promise<void>
  onAddConnection: (group: SsoGroup) => void
  onDetectClusters?: (s: Session) => Promise<void>
  favorites: Set<string>
  onToggleFavorite: (key: string) => void
  envOverrides: Record<string, EnvType>
  onSetEnvOverride: (startUrl: string, accountId: string, env: EnvType | null) => void
  customTags: Record<string, CustomTag>
  onSetCustomTag: (startUrl: string, accountId: string, tag: CustomTag | null) => void
  onRenameSso?: (startUrl: string, alias: string) => void
  /** Per-account display aliases, keyed by `${startUrl}|${accountId}`. */
  accountAliases?: Record<string, string>
  onRenameAccount?: (startUrl: string, accountId: string, alias: string) => void
}

function favoriteKey(startUrl: string, accountId: string, roleName: string): string {
  return `${startUrl}|${accountId}|${roleName}`
}

interface AccountRow {
  key: string
  name: string
  accountId: string | null
  roleName: string | null
  region: string
  method: Session['method']
  environment: Session['environment']
  session: Session | null
  profile: Profile
}

function maskId(id: string): string {
  return id.length <= 4 ? id : `••••${id.slice(-4)}`
}

export function Accounts({
  sessions, ssoGroups, isLoading, selectedSession,
  onSelectSession, onStartSession, onAddConnection, onDetectClusters,
  favorites, onToggleFavorite, envOverrides, onSetEnvOverride,
  customTags, onSetCustomTag, onRenameSso,
  accountAliases = {}, onRenameAccount,
}: AccountsProps) {
  const [filter, setFilter] = useState<FilterType>('all')
  const [search, setSearch] = useState('')
  const [wizardOpen, setWizardOpen] = useState(false)
  const [starting, setStarting] = useState<string | null>(null)
  // Store only the key — this way when `sessions` updates (e.g. after
  // detecting clusters), the derived `selectedAccount` reflects fresh state.
  const [selectedAccountKey, setSelectedAccountKey] = useState<string | null>(null)

  const allRows: AccountRow[] = useMemo(() => {
    const rows: AccountRow[] = []
    const usedKeys = new Set<string>()

    for (const s of sessions) {
      const key = `${s.accountId}-${s.roleName}`
      usedKeys.add(key)
      const aliasKey = `${s.startUrl}|${s.accountId}`
      rows.push({
        key,
        name: accountAliases[aliasKey] ?? s.accountName,
        accountId: s.accountId,
        roleName: s.roleName,
        region: s.region,
        method: s.method,
        environment: s.environment,
        session: s,
        profile: {
          name: s.accountName,
          accountName: s.accountName,
          startUrl: s.startUrl, ssoRegion: s.ssoRegion,
          accountId: s.accountId, roleName: s.roleName, region: s.region,
        },
      })
    }

    for (const group of ssoGroups) {
      for (const p of group.profiles) {
        const key = `${p.accountId}-${p.roleName}`
        if (usedKeys.has(key)) continue
        usedKeys.add(key)
        const cleanAccountName = p.accountName
          ?? p.name.split(' / ')[0]
          ?? p.name
        const aliasKey = `${group.startUrl}|${p.accountId}`
        rows.push({
          key,
          name: accountAliases[aliasKey] ?? cleanAccountName,
          accountId: p.accountId,
          roleName: p.roleName,
          region: p.region,
          method: 'sso',
          environment: detectEnv(cleanAccountName),
          session: null,
          profile: p,
        })
      }
    }

    return rows
  }, [sessions, ssoGroups, accountAliases])

  const filtered = useMemo(() => {
    return allRows.filter(row => {
      const favKey = row.accountId && row.roleName
        ? favoriteKey(row.profile.startUrl, row.accountId, row.roleName)
        : null
      const isFav = favKey ? favorites.has(favKey) : false
      if (filter === 'favorites' && !isFav) return false
      if (filter !== 'all' && filter !== 'favorites' && row.method !== filter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        if (!row.name.toLowerCase().includes(q) &&
            !(row.accountId?.includes(q)) &&
            !(row.roleName?.toLowerCase().includes(q))) return false
      }
      return true
    })
  }, [allRows, filter, search, favorites])

  // Group rows into SSO connection → account → [roles] shape so the UI mirrors
  // the AWS SSO portal. Flat list became unusable with many accounts/roles.
  // Non-SSO rows (iam/federated/chained) fall into an "Other" bucket at the end.
  const grouped = useMemo(() => {
    type AccountGroup = { accountId: string; accountName: string; rows: AccountRow[] }
    type SsoView = { startUrl: string; label: string; accounts: AccountGroup[] }
    const bySso = new Map<string, SsoView>()
    const orphan: AccountRow[] = []

    // Build the SSO section label. We want to show BOTH the directory ID
    // (from the hostname — e.g. `D-9267d090d7`) and the user-given alias,
    // joined with a `·`. The directory ID is how IAM Identity Center
    // identifies the SSO instance; the alias is how the user thinks of it.
    const buildLabel = (startUrl: string, alias?: string): string => {
      let host = 'SSO'
      try { host = new URL(startUrl).hostname.split('.')[0] } catch { /* keep */ }
      // Uppercase the leading `d-` so directory IDs read as `D-9267d090d7`.
      const directory = host.replace(/^d-/i, 'D-')
      const trimmed = (alias ?? '').trim()
      return trimmed ? `${directory} · ${trimmed}` : directory
    }
    const ssoLabels = new Map<string, string>()
    for (const g of ssoGroups) {
      ssoLabels.set(g.startUrl, buildLabel(g.startUrl, g.alias))
    }

    for (const row of filtered) {
      if (row.method !== 'sso' || !row.accountId) { orphan.push(row); continue }
      const startUrl = row.profile.startUrl
      if (!bySso.has(startUrl)) {
        const label = ssoLabels.get(startUrl) ?? buildLabel(startUrl)
        bySso.set(startUrl, { startUrl, label, accounts: [] })
      }
      const sso = bySso.get(startUrl)!
      let acc = sso.accounts.find(a => a.accountId === row.accountId)
      if (!acc) { acc = { accountId: row.accountId, accountName: row.name, rows: [] }; sso.accounts.push(acc) }
      acc.rows.push(row)
    }
    for (const sso of bySso.values()) {
      sso.accounts.sort((a, b) => a.accountName.localeCompare(b.accountName))
      for (const acc of sso.accounts) acc.rows.sort((a, b) => (a.roleName ?? '').localeCompare(b.roleName ?? ''))
    }
    const ssoSections = Array.from(bySso.values()).sort((a, b) => a.label.localeCompare(b.label))
    orphan.sort((a, b) => a.name.localeCompare(b.name))
    return { ssoGroups: ssoSections, orphan }
  }, [filtered, ssoGroups])

  const counts = useMemo(() => ({
    all: allRows.length,
    sso: allRows.filter(r => r.method === 'sso').length,
    iam: allRows.filter(r => r.method === 'iam').length,
    federated: allRows.filter(r => r.method === 'federated').length,
    chained: allRows.filter(r => r.method === 'chained').length,
    favorites: allRows.filter(r => {
      if (!r.accountId || !r.roleName) return false
      return favorites.has(favoriteKey(r.profile.startUrl, r.accountId, r.roleName))
    }).length,
  }), [allRows, favorites])

  const handleStart = async (row: AccountRow, region?: string) => {
    if (!row.profile.accountId || !row.profile.roleName) return
    setStarting(row.key)
    const profile = region ? { ...row.profile, region } : row.profile
    try { await onStartSession(profile) } catch {} finally { setStarting(null) }
  }

  const handleRowClick = (row: AccountRow) => {
    setSelectedAccountKey(prev => prev === row.key ? null : row.key)
  }

  const selectedAccount = useMemo(
    () => allRows.find(r => r.key === selectedAccountKey) ?? null,
    [allRows, selectedAccountKey],
  )

  const FILTERS: { id: FilterType; label: string }[] = [
    { id: 'all',       label: `All ${counts.all}` },
    { id: 'sso',       label: `SSO ${counts.sso}` },
    { id: 'iam',       label: `IAM User ${counts.iam}` },
    { id: 'federated', label: `Federated ${counts.federated}` },
    { id: 'chained',   label: `Chained ${counts.chained}` },
    { id: 'favorites', label: `★ ${counts.favorites}` },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle flex-shrink-0">
        <div>
          <h1 className="font-display font-bold text-text-primary text-base">Accounts</h1>
          <p className="text-text-muted text-xs mt-0.5">
            Manage cloud connections, aliases, roles, and session settings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search accounts..."
              className="bg-bg-surface border border-border rounded-lg pl-7 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-primary w-48 transition-colors"
            />
          </div>
          <Button variant="primary" size="sm" onClick={() => setWizardOpen(true)}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Connection
          </Button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-1.5 px-5 py-2 border-b border-border-subtle flex-shrink-0">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === f.id
                ? 'bg-primary text-bg-base'
                : 'bg-bg-surface text-text-secondary hover:text-text-primary hover:bg-bg-surface2 border border-border'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content: table + optional detail panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Account list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div>{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}</div>
          ) : allRows.length === 0 ? (
            <EmptyState
              variant="wave"
              title="No connections yet"
              description="Add your first cloud connection to get started. CloudOrbit stores credentials securely in the system keychain."
              action={{ label: '+ Add Connection', onClick: () => setWizardOpen(true) }}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              variant="search"
              title="No matching accounts"
              description="Try adjusting your search or filter."
              action={{ label: 'Clear filters', onClick: () => { setFilter('all'); setSearch('') } }}
            />
          ) : (
            <div className="py-2">
              {grouped.ssoGroups.map(sso => (
                <SsoSection
                  key={sso.startUrl}
                  sso={sso}
                  selectedAccountKey={selectedAccountKey}
                  startingKey={starting}
                  favorites={favorites}
                  onToggleFavorite={onToggleFavorite}
                  envOverrides={envOverrides}
                  onSetEnvOverride={onSetEnvOverride}
                  customTags={customTags}
                  onSetCustomTag={onSetCustomTag}
                  onRowClick={handleRowClick}
                  onStart={handleStart}
                  onRename={onRenameSso ? (alias: string) => onRenameSso(sso.startUrl, alias) : undefined}
                  currentAlias={ssoGroups.find(g => g.startUrl === sso.startUrl)?.alias ?? ''}
                  accountAliases={accountAliases}
                  onRenameAccount={onRenameAccount}
                />
              ))}
              {grouped.orphan.length > 0 && (
                <OrphanSection
                  rows={grouped.orphan}
                  selectedAccountKey={selectedAccountKey}
                  startingKey={starting}
                  favorites={favorites}
                  onToggleFavorite={onToggleFavorite}
                  onRowClick={handleRowClick}
                  onStart={handleStart}
                />
              )}
            </div>
          )}
        </div>

        {/* Account detail panel */}
        <AnimatePresence>
          {selectedAccount && (
            <AccountDetailPanel
              account={selectedAccount}
              onClose={() => setSelectedAccountKey(null)}
              onStart={(region) => handleStart(selectedAccount, region)}
              isStarting={starting === selectedAccount.key}
              onDetectClusters={onDetectClusters}
            />
          )}
        </AnimatePresence>
      </div>

      <AddConnectionWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSave={onAddConnection}
      />
    </div>
  )
}

// ── Grouped SSO rendering ────────────────────────────────────────────────────

interface SsoSectionProps {
  sso: { startUrl: string; label: string; accounts: { accountId: string; accountName: string; rows: AccountRow[] }[] }
  selectedAccountKey: string | null
  startingKey: string | null
  favorites: Set<string>
  onToggleFavorite: (key: string) => void
  envOverrides: Record<string, EnvType>
  onSetEnvOverride: (startUrl: string, accountId: string, env: EnvType | null) => void
  customTags: Record<string, CustomTag>
  onSetCustomTag: (startUrl: string, accountId: string, tag: CustomTag | null) => void
  onRowClick: (row: AccountRow) => void
  onStart: (row: AccountRow) => void
  onRename?: (alias: string) => void
  currentAlias?: string
  accountAliases?: Record<string, string>
  onRenameAccount?: (startUrl: string, accountId: string, alias: string) => void
}

function SsoSection({ sso, selectedAccountKey, startingKey, favorites, onToggleFavorite, envOverrides, onSetEnvOverride, customTags, onSetCustomTag, onRowClick, onStart, onRename, currentAlias, accountAliases = {}, onRenameAccount }: SsoSectionProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(currentAlias ?? '')
  const roleCount = sso.accounts.reduce((n, a) => n + a.rows.length, 0)

  useEffect(() => {
    if (!renaming) setDraft(currentAlias ?? '')
  }, [currentAlias, renaming])

  const commit = () => {
    if (onRename) onRename(draft)
    setRenaming(false)
  }

  return (
    <div className="mb-4">
      <div className="w-full flex items-center gap-2 px-5 py-2 bg-bg-elevated border-b border-border-subtle sticky top-0 z-10">
        <button
          onClick={() => setCollapsed(c => !c)}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <svg className={`w-3 h-3 text-text-muted transition-transform ${collapsed ? '' : 'rotate-90'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 6 15 12 9 18"/>
          </svg>
          <span className="text-xs font-semibold text-text-primary uppercase tracking-wider">{sso.label}</span>
        </button>
        <span className="text-[10px] text-text-muted font-mono">
          {sso.accounts.length} account{sso.accounts.length !== 1 ? 's' : ''} · {roleCount} role{roleCount !== 1 ? 's' : ''}
        </span>
        {onRename && !renaming && (
          <button
            onClick={() => setRenaming(true)}
            className="text-[10px] text-text-muted hover:text-primary transition-colors ml-1"
            title="Rename connection (set alias)"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          </button>
        )}
        {renaming && (
          <div className="flex items-center gap-1 ml-1">
            <input
              autoFocus
              type="text"
              value={draft}
              placeholder="Alias (e.g. Polaris)"
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') commit()
                if (e.key === 'Escape') { setDraft(currentAlias ?? ''); setRenaming(false) }
              }}
              className="text-[11px] bg-bg-surface border border-border rounded px-2 py-0.5 outline-none focus:border-primary w-32"
            />
            <button onClick={commit} className="text-[10px] text-primary hover:text-primary/80 px-1" title="Save">✓</button>
            <button
              onClick={() => { setDraft(currentAlias ?? ''); setRenaming(false) }}
              className="text-[10px] text-text-muted hover:text-text-primary px-1"
              title="Cancel"
            >✕</button>
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="px-2">
          {sso.accounts.map(acc => (
            <AccountAccordion
              key={acc.accountId}
              sso={sso}
              account={acc}
              selectedAccountKey={selectedAccountKey}
              startingKey={startingKey}
              favorites={favorites}
              onToggleFavorite={onToggleFavorite}
              envOverrides={envOverrides}
              onSetEnvOverride={onSetEnvOverride}
              customTags={customTags}
              onSetCustomTag={onSetCustomTag}
              onRowClick={onRowClick}
              onStart={onStart}
              accountAliases={accountAliases}
              onRenameAccount={onRenameAccount}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function AccountAccordion({
  sso, account, selectedAccountKey, startingKey, favorites, onToggleFavorite,
  envOverrides, onSetEnvOverride, customTags, onSetCustomTag, onRowClick, onStart,
  accountAliases = {}, onRenameAccount,
}: {
  sso: { startUrl: string; label: string }
  account: { accountId: string; accountName: string; rows: AccountRow[] }
  selectedAccountKey: string | null
  startingKey: string | null
  favorites: Set<string>
  onToggleFavorite: (key: string) => void
  envOverrides: Record<string, EnvType>
  onSetEnvOverride: (startUrl: string, accountId: string, env: EnvType | null) => void
  customTags: Record<string, CustomTag>
  onSetCustomTag: (startUrl: string, accountId: string, tag: CustomTag | null) => void
  onRowClick: (row: AccountRow) => void
  onStart: (row: AccountRow) => void
  accountAliases?: Record<string, string>
  onRenameAccount?: (startUrl: string, accountId: string, alias: string) => void
}) {
  // Default-expanded when a row inside is selected, the account has a live
  // session, or any of its roles is favorited — those are the cases the user
  // most likely cares about.
  const anyFav = account.rows.some(r =>
    r.accountId && r.roleName && favorites.has(favoriteKey(r.profile.startUrl, r.accountId, r.roleName))
  )
  const [open, setOpen] = useState(() => {
    if (account.rows.some(r => r.session)) return true
    if (selectedAccountKey && account.rows.some(r => r.key === selectedAccountKey)) return true
    return anyFav
  })
  // Re-open the accordion reactively when a role inside becomes a favorite,
  // so switching to the Favorites tab reveals the account without extra clicks.
  useEffect(() => {
    if (anyFav) setOpen(true)
  }, [anyFav])
  const activeCount = account.rows.filter(r => r.session && new Date(r.session.expiresAt).getTime() > Date.now()).length
  // Account-level env — override first, then fall back to the auto-detected
  // value from the account name. The dot on the badge signals overridden.
  const overrideKey = envOverrideKey(sso.startUrl, account.accountId)
  const customTag = customTags[overrideKey]
  const env = envOverrides[overrideKey] ?? detectEnv(account.accountName)
  const overridden = !!customTag || overrideKey in envOverrides

  // Account rename / alias state
  const accountAliasKey = `${sso.startUrl}|${account.accountId}`
  const currentAccountAlias = accountAliases[accountAliasKey] ?? ''
  const displayName = currentAccountAlias || account.accountName
  const [renamingAccount, setRenamingAccount] = useState(false)
  const [accountDraft, setAccountDraft] = useState(currentAccountAlias)
  useEffect(() => {
    if (!renamingAccount) setAccountDraft(currentAccountAlias)
  }, [currentAccountAlias, renamingAccount])
  const commitAccountRename = () => {
    if (onRenameAccount) onRenameAccount(sso.startUrl, account.accountId, accountDraft)
    setRenamingAccount(false)
  }

  // Favorites first within the account.
  const sortedRows = [...account.rows].sort((a, b) => {
    const aKey = a.accountId && a.roleName ? favoriteKey(a.profile.startUrl, a.accountId, a.roleName) : null
    const bKey = b.accountId && b.roleName ? favoriteKey(b.profile.startUrl, b.accountId, b.roleName) : null
    const aFav = aKey ? favorites.has(aKey) : false
    const bFav = bKey ? favorites.has(bKey) : false
    if (aFav !== bFav) return aFav ? -1 : 1
    return (a.roleName ?? '').localeCompare(b.roleName ?? '')
  })

  return (
    <div className="mb-1 rounded-lg overflow-hidden border border-border-subtle">
      <div
        onClick={e => !renamingAccount && setOpen(o => !o)}
        className="w-full group flex items-center gap-2 px-3 py-2 bg-bg-surface hover:bg-bg-surface2 transition-colors text-left cursor-pointer"
      >
        <svg className={`w-3 h-3 text-text-muted flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="9 6 15 12 9 18"/>
        </svg>
        <EnvEditableBadge
          env={env}
          custom={customTag}
          overridden={overridden}
          onChange={next => {
            onSetCustomTag(sso.startUrl, account.accountId, null)
            onSetEnvOverride(sso.startUrl, account.accountId, next)
          }}
          onSetCustom={tag => {
            onSetEnvOverride(sso.startUrl, account.accountId, null)
            onSetCustomTag(sso.startUrl, account.accountId, tag)
          }}
          onReset={() => {
            onSetCustomTag(sso.startUrl, account.accountId, null)
            onSetEnvOverride(sso.startUrl, account.accountId, null)
          }}
        />
        {renamingAccount ? (
          <div className="flex items-center gap-1 flex-1 min-w-0" onClick={e => e.stopPropagation()}>
            <input
              autoFocus
              type="text"
              value={accountDraft}
              placeholder={account.accountName}
              onChange={e => setAccountDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') commitAccountRename()
                if (e.key === 'Escape') { setAccountDraft(currentAccountAlias); setRenamingAccount(false) }
              }}
              className="text-[11px] bg-bg-surface border border-primary/50 rounded px-2 py-0.5 outline-none focus:border-primary flex-1 min-w-0 max-w-[160px]"
            />
            <button onClick={commitAccountRename} className="text-[10px] text-primary hover:text-primary/80 px-1 flex-shrink-0" title="Save">✓</button>
            <button
              onClick={() => { setAccountDraft(currentAccountAlias); setRenamingAccount(false) }}
              className="text-[10px] text-text-muted hover:text-text-primary px-1 flex-shrink-0"
              title="Cancel"
            >✕</button>
          </div>
        ) : (
          <span className="flex items-center gap-1 flex-1 min-w-0" title={currentAccountAlias ? account.accountName : undefined}>
              <span className="text-sm font-medium text-text-primary truncate">
                {displayName}
                {currentAccountAlias && (
                  <span className="ml-1.5 text-[10px] text-text-muted font-normal font-mono">({account.accountName})</span>
                )}
              </span>
              {onRenameAccount && (
                <button
                  onClick={e => { e.stopPropagation(); setRenamingAccount(true) }}
                  className="flex-shrink-0 text-text-muted hover:text-primary transition-colors p-0.5 rounded opacity-40 hover:opacity-100"
                  title="Rename account"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                </button>
              )}
            </span>
        )}
        <span className="text-[10px] text-text-muted font-mono flex-shrink-0">{maskId(account.accountId)}</span>
        <span className="text-[10px] text-text-muted flex-shrink-0">
          {account.rows.length} role{account.rows.length !== 1 ? 's' : ''}
          {activeCount > 0 && <span className="ml-1.5 text-success">· {activeCount} active</span>}
        </span>
      </div>

      {open && (
        <div className="divide-y divide-border-subtle">
          {sortedRows.map(row => {
            const favKey = row.accountId && row.roleName
              ? favoriteKey(row.profile.startUrl, row.accountId, row.roleName)
              : null
            return (
              <RoleRow
                key={row.key}
                row={row}
                isSelected={selectedAccountKey === row.key}
                isStarting={startingKey === row.key}
                isFavorite={favKey ? favorites.has(favKey) : false}
                onToggleFavorite={favKey ? () => onToggleFavorite(favKey) : undefined}
                onClick={() => onRowClick(row)}
                onStart={() => onStart(row)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function RoleRow({ row, isSelected, isStarting, isFavorite, onToggleFavorite, onClick, onStart }: {
  row: AccountRow; isSelected: boolean; isStarting: boolean
  isFavorite: boolean
  onToggleFavorite?: () => void
  onClick: () => void; onStart: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const { label: expiryLabel, status: expiryStatus } = row.session
    ? formatExpiry(row.session.expiresAt)
    : { label: '—', status: 'idle' as const }
  const sessionStatus = !row.session ? 'idle' :
    expiryStatus === 'expired' ? 'expired' :
    expiryStatus === 'expiring' ? 'expiring' : 'active'

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!onToggleFavorite && !row.profile.accountId) return
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY })
  }

  // Close menu on any outside click / escape.
  useEffect(() => {
    if (!menu) return
    const handle = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return
      setMenu(null)
    }
    window.addEventListener('mousedown', handle, true)
    window.addEventListener('keydown', handle)
    return () => {
      window.removeEventListener('mousedown', handle, true)
      window.removeEventListener('keydown', handle)
    }
  }, [menu])

  return (
    <div
      onClick={onClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors text-xs ${
        isSelected ? 'bg-primary/8 border-l-2 border-l-primary' : hovered ? 'bg-bg-surface' : 'bg-bg-elevated'
      }`}
    >
      <StatusDot status={sessionStatus} size="sm" />
      {/* Favorite star — hidden until hover (or always-on when favorited) */}
      {onToggleFavorite && (
        <button
          onClick={e => { e.stopPropagation(); onToggleFavorite() }}
          className={`flex-shrink-0 rounded p-0.5 transition-opacity ${
            isFavorite ? 'opacity-100 text-warning' : hovered ? 'opacity-60 text-text-muted hover:text-warning' : 'opacity-0'
          }`}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        </button>
      )}
      <span className="flex-1 min-w-0 font-mono text-text-secondary truncate">{row.roleName ?? '—'}</span>
      <span className="font-mono text-text-muted flex-shrink-0">{row.region}</span>
      <MethodChip method={row.method} />
      <span className={`font-mono flex-shrink-0 w-16 text-right ${
        expiryStatus === 'expired' ? 'text-danger' :
        expiryStatus === 'expiring' ? 'text-warning' : 'text-text-muted'
      }`}>{expiryLabel}</span>
      <div className="flex items-center gap-1 w-16 justify-end">
        <StatusChip status={sessionStatus} />
        {hovered && !row.session && (
          <Button
            variant="secondary" size="sm" loading={isStarting}
            className="py-0.5 px-1.5 text-[10px]"
            onClick={e => { e.stopPropagation(); onStart() }}
          >
            Start
          </Button>
        )}
        {hovered && row.session && sessionStatus === 'expired' && (
          <Button
            variant="secondary" size="sm" loading={isStarting}
            className="py-0.5 px-1.5 text-[10px]"
            onClick={e => { e.stopPropagation(); onStart() }}
          >
            Renew
          </Button>
        )}
      </div>

      {menu && (
        <div
          className="fixed z-50 bg-bg-elevated border border-border rounded-lg shadow-xl py-1 min-w-40"
          style={{ left: menu.x, top: menu.y }}
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
        >
          {onToggleFavorite && (
            <button
              onClick={() => { onToggleFavorite(); setMenu(null) }}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-bg-surface text-text-secondary flex items-center gap-2"
            >
              <svg className="w-3 h-3 text-warning" viewBox="0 0 24 24" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              {isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            </button>
          )}
          {!row.session && row.profile.accountId && row.profile.roleName && (
            <button
              onClick={() => { onStart(); setMenu(null) }}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-bg-surface text-text-secondary"
            >
              Start session
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function OrphanSection({ rows, selectedAccountKey, startingKey, favorites, onToggleFavorite, onRowClick, onStart }: {
  rows: AccountRow[]
  selectedAccountKey: string | null
  startingKey: string | null
  favorites: Set<string>
  onToggleFavorite: (key: string) => void
  onRowClick: (row: AccountRow) => void
  onStart: (row: AccountRow) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div className="mb-4">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-2 px-5 py-2 bg-bg-elevated border-b border-border-subtle sticky top-0 z-10 text-left hover:bg-bg-surface transition-colors"
      >
        <svg className={`w-3 h-3 text-text-muted transition-transform ${collapsed ? '' : 'rotate-90'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="9 6 15 12 9 18"/>
        </svg>
        <span className="text-xs font-semibold text-text-primary uppercase tracking-wider">Other</span>
        <span className="text-[10px] text-text-muted font-mono">{rows.length} {rows.length === 1 ? 'entry' : 'entries'}</span>
      </button>
      {!collapsed && (
        <div className="px-2">
          {rows.map(row => {
            const favKey = row.accountId && row.roleName
              ? favoriteKey(row.profile.startUrl, row.accountId, row.roleName)
              : null
            return (
              <div key={row.key} className="mb-1 rounded-lg overflow-hidden border border-border-subtle">
                <RoleRow
                  row={row}
                  isSelected={selectedAccountKey === row.key}
                  isStarting={startingKey === row.key}
                  isFavorite={favKey ? favorites.has(favKey) : false}
                  onToggleFavorite={favKey ? () => onToggleFavorite(favKey) : undefined}
                  onClick={() => onRowClick(row)}
                  onStart={() => onStart(row)}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function AccountTableRow({ row, index, isSelected, isStarting, onClick, onStart }: {
  row: AccountRow; index: number; isSelected: boolean
  isStarting: boolean; onClick: () => void; onStart: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const { label: expiryLabel, status: expiryStatus } = row.session
    ? formatExpiry(row.session.expiresAt)
    : { label: '—', status: 'idle' as const }

  const sessionStatus = !row.session ? 'idle' :
    expiryStatus === 'expired' ? 'expired' :
    expiryStatus === 'expiring' ? 'expiring' : 'active'

  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, delay: index * 0.02 }}
      className={`grid items-center px-4 py-2.5 border-b border-border-subtle cursor-pointer transition-colors group ${
        isSelected ? 'bg-primary/8 border-l-2 border-l-primary' : hovered ? 'bg-bg-surface' : ''
      }`}
      style={{ gridTemplateColumns: '24px 1fr 90px 90px 70px 70px 80px 80px' }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <StatusDot status={sessionStatus} size="sm" />
      <div className="flex items-center gap-2 min-w-0">
        <EnvBadge env={row.environment} />
        <span className={`text-xs font-medium truncate ${row.session ? 'text-text-primary' : 'text-text-secondary'}`}>
          {row.name || row.profile.name || 'Unknown'}
        </span>
        {row.session?.isFavorite && (
          <svg className="w-3 h-3 text-warning flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        )}
      </div>
      <div className="font-mono text-text-muted text-xs">{row.accountId ? maskId(row.accountId) : '—'}</div>
      <div className="text-text-secondary text-xs truncate">{row.roleName ?? '—'}</div>
      <div className="font-mono text-text-muted text-xs">{row.region}</div>
      <div><MethodChip method={row.method} /></div>
      <div className={`font-mono text-xs ${
        expiryStatus === 'expired' ? 'text-danger' :
        expiryStatus === 'expiring' ? 'text-warning' : 'text-text-secondary'
      }`}>{expiryLabel}</div>
      <div className="flex items-center gap-1">
        <StatusChip status={sessionStatus} />
        {hovered && !row.session && (
          <Button
            variant="secondary" size="sm" loading={isStarting}
            className="ml-1 py-0.5 px-1.5 text-[10px]"
            onClick={e => { e.stopPropagation(); onStart() }}
          >
            Start
          </Button>
        )}
      </div>
    </motion.div>
  )
}

// ── Account Detail Panel ────────────────────────────────────────────────────

type DetailTab = 'overview' | 'roles' | 'clusters' | 'rules' | 'security'

function AccountDetailPanel({ account, onClose, onStart, isStarting, onDetectClusters }: {
  account: AccountRow
  onClose: () => void
  onStart: (region: string) => void
  isStarting: boolean
  onDetectClusters?: (s: Session) => Promise<void>
}) {
  const [tab, setTab] = useState<DetailTab>('overview')
  const { label: expiryLabel, status: expiryStatus } = account.session
    ? formatExpiry(account.session.expiresAt)
    : { label: '—', status: 'idle' as const }
  const sessionStatus = !account.session ? 'idle' :
    expiryStatus === 'expired' ? 'expired' :
    expiryStatus === 'expiring' ? 'expiring' : 'active'

  const TABS: { id: DetailTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'roles',    label: 'Roles' },
    { id: 'clusters', label: 'Clusters' },
    { id: 'rules',    label: 'Rules' },
    { id: 'security', label: 'Security' },
  ]

  return (
    <motion.div
      initial={{ x: 280, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 280, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="w-72 flex-shrink-0 border-l border-border bg-bg-elevated flex flex-col overflow-hidden"
    >
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <StatusDot status={sessionStatus} size="sm" />
          <div className="min-w-0">
            <h3 className="text-text-primary font-semibold text-sm truncate">{account.name}</h3>
            <p className="text-text-muted text-[10px]">{account.accountId ? maskId(account.accountId) : '—'}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-text-muted hover:text-text-primary transition-colors p-1 rounded-lg hover:bg-bg-surface flex-shrink-0"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border-subtle flex-shrink-0 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 min-w-0 py-2 text-[10px] font-medium transition-colors border-b-2 whitespace-nowrap px-1 ${
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-text-secondary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {tab === 'overview' && <OverviewTab account={account} expiryLabel={expiryLabel} expiryStatus={expiryStatus} sessionStatus={sessionStatus} onStart={onStart} isStarting={isStarting} />}
            {tab === 'roles' && <RolesTab account={account} />}
            {tab === 'clusters' && <ClustersTab account={account} onDetectClusters={onDetectClusters} />}
            {tab === 'rules' && <RulesTab />}
            {tab === 'security' && <SecurityTab account={account} onClose={onClose} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ── Tab: Overview ────────────────────────────────────────────────────────────

const AWS_REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'ca-central-1', 'ca-west-1',
  'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1', 'eu-central-2', 'eu-north-1', 'eu-south-1', 'eu-south-2',
  'ap-east-1', 'ap-south-1', 'ap-south-2', 'ap-southeast-1', 'ap-southeast-2', 'ap-southeast-3', 'ap-southeast-4', 'ap-northeast-1', 'ap-northeast-2', 'ap-northeast-3',
  'me-south-1', 'me-central-1', 'af-south-1', 'il-central-1', 'sa-east-1',
  'us-gov-east-1', 'us-gov-west-1',
]

function OverviewTab({ account, expiryLabel, expiryStatus, sessionStatus, onStart, isStarting }: {
  account: AccountRow
  expiryLabel: string
  expiryStatus: 'active' | 'expiring' | 'expired' | 'idle'
  sessionStatus: 'active' | 'expiring' | 'expired' | 'idle'
  onStart: (region: string) => void
  isStarting: boolean
}) {
  const [copied, setCopied] = useState(false)
  const defaultRegion = account.region
  const regionOptions = AWS_REGIONS.includes(defaultRegion)
    ? AWS_REGIONS
    : [defaultRegion, ...AWS_REGIONS]
  const [selectedRegion, setSelectedRegion] = useState(defaultRegion)

  const copyId = () => {
    if (account.accountId) {
      navigator.clipboard.writeText(account.accountId)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <div className="px-4 py-3 space-y-4">
      {/* Badges */}
      <div className="flex items-center gap-2">
        <EnvBadge env={account.environment} />
        <MethodChip method={account.method} />
        {account.session?.isFavorite && (
          <span className="text-warning text-xs">★ Favorite</span>
        )}
      </div>

      {/* Info rows */}
      <div className="space-y-0">
        <DetailRow label="Alias" value={account.name} />
        <DetailRow label="Account ID" value={account.accountId ?? '—'} mono onCopy={account.accountId ? copyId : undefined} copied={copied} />
        <DetailRow label="Role" value={account.roleName ?? '—'} />
        {/* Region selector — allows overriding the profile default for this session */}
        <div className="flex items-center justify-between gap-2 py-1.5 border-b border-border-subtle">
          <span className="text-text-muted text-xs flex-shrink-0">Region</span>
          <select
            value={selectedRegion}
            onChange={e => setSelectedRegion(e.target.value)}
            className="bg-transparent text-text-secondary text-xs font-mono text-right border-none outline-none cursor-pointer hover:text-primary transition-colors appearance-none"
          >
            {regionOptions.map(r => (
              <option key={r} value={r} className="bg-bg-elevated text-text-primary">{r}</option>
            ))}
          </select>
        </div>
        <DetailRow label="Access" value={account.method.toUpperCase()} />
      </div>

      {/* Session status */}
      <div>
        <p className="text-text-muted text-[10px] font-semibold uppercase tracking-wider mb-2">Session</p>
        {account.session ? (
          <div className="bg-bg-surface rounded-lg p-3 border border-border-subtle space-y-2">
            <div className="flex items-center justify-between">
              <StatusChip status={sessionStatus} />
              <span className={`text-xs font-mono ${
                expiryStatus === 'expired' ? 'text-danger' :
                expiryStatus === 'expiring' ? 'text-warning' : 'text-success'
              }`}>{expiryLabel}</span>
            </div>
            <ProgressBar expiresAt={account.session.expiresAt} />
          </div>
        ) : (
          <div className="bg-bg-surface rounded-lg p-3 border border-border-subtle">
            <p className="text-text-muted text-xs">No active session</p>
          </div>
        )}
      </div>

      {/* Actions */}
      {!account.session && (
        <Button variant="primary" size="sm" className="w-full" onClick={() => onStart(selectedRegion)} loading={isStarting}>
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          Start Session
        </Button>
      )}
      {account.session && sessionStatus === 'expired' && (
        <Button variant="primary" size="sm" className="w-full" onClick={() => onStart(selectedRegion)} loading={isStarting}>
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
          </svg>
          Renew Session
        </Button>
      )}
    </div>
  )
}

function DetailRow({ label, value, mono, onCopy, copied }: {
  label: string; value: string; mono?: boolean; onCopy?: () => void; copied?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-border-subtle last:border-0">
      <span className="text-text-muted text-xs flex-shrink-0">{label}</span>
      <div className="flex items-center gap-1 min-w-0">
        <span className={`text-text-secondary text-xs truncate ${mono ? 'font-mono' : ''}`}>{value}</span>
        {onCopy && (
          <button onClick={onCopy} className="text-text-muted hover:text-primary transition-colors p-0.5 rounded flex-shrink-0">
            {copied ? (
              <svg className="w-3 h-3 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
            ) : (
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Tab: Roles ────────────────────────────────────────────────────────────────

function RolesTab({ account }: { account: AccountRow }) {
  const roles = account.roleName ? [account.roleName] : []

  return (
    <div className="px-4 py-3">
      <p className="text-text-muted text-[10px] font-semibold uppercase tracking-wider mb-3">Available Roles</p>
      {roles.length === 0 ? (
        <p className="text-text-muted text-xs">No roles configured.</p>
      ) : (
        <div className="space-y-1.5">
          {roles.map(role => (
            <div key={role} className="flex items-center justify-between gap-2 bg-bg-surface rounded-lg px-3 py-2 border border-border-subtle">
              <div className="min-w-0">
                <p className="text-text-primary text-xs font-medium truncate">{role}</p>
                {account.accountId && (
                  <p className="text-text-muted text-[10px] font-mono truncate">
                    arn:aws:iam::{account.accountId}:role/{role}
                  </p>
                )}
              </div>
              <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">Default</span>
            </div>
          ))}
        </div>
      )}
      <button className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs text-text-secondary hover:text-text-primary bg-bg-surface hover:bg-bg-surface2 border border-dashed border-border rounded-lg px-3 py-2 transition-colors">
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Add Role
      </button>
    </div>
  )
}

// ── Tab: Clusters ─────────────────────────────────────────────────────────────

function ClustersTab({ account, onDetectClusters }: {
  account: AccountRow
  onDetectClusters?: (s: Session) => Promise<void>
}) {
  const clusters: ClusterInfo[] = account.session?.clusters ?? []
  const [detecting, setDetecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const doDetect = async () => {
    if (!account.session || !onDetectClusters) return
    setDetecting(true); setError(null)
    try { await onDetectClusters(account.session) }
    catch (e) { setError(String(e)) }
    finally { setDetecting(false) }
  }

  return (
    <div className="px-4 py-3">
      <p className="text-text-muted text-[10px] font-semibold uppercase tracking-wider mb-3">
        EKS Clusters ({clusters.length})
      </p>
      {clusters.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-text-muted text-xs mb-3">
            {account.session ? 'No clusters detected for this account.' : 'Start a session to detect clusters.'}
          </p>
          {account.session && (
            <button
              onClick={doDetect}
              disabled={detecting}
              className="text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
            >
              {detecting ? 'Detecting…' : 'Detect Clusters'}
            </button>
          )}
          {error && (
            <pre className="mt-3 text-left bg-danger/10 border border-danger/30 rounded-lg px-2 py-1.5 text-danger/90 text-[10px] whitespace-pre-wrap break-words font-mono leading-relaxed">
              {error}
            </pre>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {clusters.map(cluster => (
            <div key={cluster.name} className="flex items-center justify-between gap-2 bg-bg-surface rounded-lg px-3 py-2 border border-border-subtle">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cluster.status === 'ACTIVE' ? 'bg-success' : 'bg-text-muted'}`} />
                <div className="min-w-0">
                  <p className="text-text-primary text-xs font-medium truncate">{cluster.name}</p>
                  <p className="text-text-muted text-[10px]">{cluster.region}{cluster.version ? ` · v${cluster.version}` : ''}</p>
                </div>
              </div>
              <button className="text-[10px] text-primary hover:text-blue-300 transition-colors flex-shrink-0 px-2 py-1 rounded bg-primary/10 hover:bg-primary/20">
                Activate
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tab: Session Rules ────────────────────────────────────────────────────────

function RulesTab() {
  const [autoRenew, setAutoRenew] = useState(true)
  const [notifyAt, setNotifyAt] = useState('30')
  const [maxHours, setMaxHours] = useState('8')

  return (
    <div className="px-4 py-3 space-y-4">
      <p className="text-text-muted text-[10px] font-semibold uppercase tracking-wider">Session Rules</p>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-text-primary text-xs font-medium">Auto-renew</p>
          <p className="text-text-muted text-[10px]">Silently renew before expiry</p>
        </div>
        <Toggle checked={autoRenew} onChange={setAutoRenew} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-text-muted text-[10px] font-medium uppercase tracking-wider">Notify before expiry</label>
        <select
          value={notifyAt}
          onChange={e => setNotifyAt(e.target.value)}
          className="field-input"
        >
          <option value="15">15 minutes</option>
          <option value="30">30 minutes</option>
          <option value="60">1 hour</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-text-muted text-[10px] font-medium uppercase tracking-wider">Max session hours</label>
        <select
          value={maxHours}
          onChange={e => setMaxHours(e.target.value)}
          className="field-input"
        >
          <option value="1">1 hour</option>
          <option value="4">4 hours</option>
          <option value="8">8 hours</option>
          <option value="12">12 hours</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-text-muted text-[10px] font-medium uppercase tracking-wider">Session name template</label>
        <input
          type="text"
          defaultValue="cloudorbit-{alias}-{date}"
          className="field-input font-mono text-xs"
        />
        <p className="text-text-muted text-[10px]">Used as the session name in STS calls</p>
      </div>
    </div>
  )
}

// ── Tab: Security ─────────────────────────────────────────────────────────────

function SecurityTab({ account, onClose }: { account: AccountRow; onClose: () => void }) {
  const [confirmRemove, setConfirmRemove] = useState(false)

  return (
    <div className="px-4 py-3 space-y-4">
      <p className="text-text-muted text-[10px] font-semibold uppercase tracking-wider">Credential Storage</p>

      <div className="bg-success/8 border border-success/20 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-success flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
          <span className="text-success text-xs font-medium">macOS Keychain</span>
        </div>
        <p className="text-text-muted text-[10px]">All credentials are stored in macOS Keychain. No plain-text secrets on disk.</p>
      </div>

      <div className="space-y-0">
        <DetailRow label="Long-term keys" value="Not stored ✓" />
        <DetailRow label="Keychain item" value={`cloudorbit.${account.accountId ?? 'unknown'}`} mono />
        <DetailRow label="Last rotation" value={account.session ? '2h ago' : 'Never'} />
      </div>

      <div className="border-t border-border-subtle pt-4">
        {!confirmRemove ? (
          <button
            onClick={() => setConfirmRemove(true)}
            className="w-full flex items-center justify-center gap-2 text-xs text-danger hover:text-danger/80 bg-danger/8 hover:bg-danger/12 border border-danger/20 rounded-lg px-3 py-2 transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/>
            </svg>
            Remove Account
          </button>
        ) : (
          <div className="bg-danger/8 border border-danger/20 rounded-lg p-3 space-y-2">
            <p className="text-danger text-xs font-medium">Remove this account?</p>
            <p className="text-text-muted text-[10px]">This will delete the connection and all stored credentials. Sessions will be invalidated.</p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setConfirmRemove(false)}
                className="flex-1 text-xs text-text-secondary hover:text-text-primary bg-bg-surface border border-border rounded-lg py-1.5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onClose}
                className="flex-1 text-xs text-white bg-danger hover:bg-danger/80 rounded-lg py-1.5 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Accounts
