import React, { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Session, ClusterInfo, Screen } from '@/types'

interface CommandItem {
  id: string
  category: string
  label: string
  sublabel?: string
  icon: React.ReactNode
  action: () => void
  keywords?: string
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  sessions: Session[]
  clusters: ClusterInfo[]
  onNavigate: (screen: Screen) => void
  onSelectSession: (session: Session) => void
  onStartSession?: (profile: { name: string; startUrl: string; ssoRegion: string; accountId: string | null; roleName: string | null; region: string }) => void
}

function SessionIcon() {
  return (
    <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="14" rx="2"/>
      <path d="M3 20h18"/>
    </svg>
  )
}

function ClusterIcon() {
  return (
    <svg className="w-4 h-4 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>
    </svg>
  )
}

function NavIcon() {
  return (
    <svg className="w-4 h-4 text-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12h18M3 6h18M3 18h18"/>
    </svg>
  )
}

export function CommandPalette({ open, onClose, sessions, clusters, onNavigate, onSelectSession }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const allItems = useMemo<CommandItem[]>(() => [
    // Navigation
    { id: 'nav-orbit', category: 'Navigation', label: 'Orbit Overview', icon: <NavIcon />, action: () => { onNavigate('orbit'); onClose() }, keywords: 'home overview' },
    { id: 'nav-sessions', category: 'Navigation', label: 'Sessions', icon: <NavIcon />, action: () => { onNavigate('sessions'); onClose() }, keywords: 'sessions credentials' },
    { id: 'nav-clusters', category: 'Navigation', label: 'Clusters', icon: <NavIcon />, action: () => { onNavigate('clusters'); onClose() }, keywords: 'eks kubernetes k8s' },
    { id: 'nav-activity', category: 'Navigation', label: 'Activity', icon: <NavIcon />, action: () => { onNavigate('activity'); onClose() }, keywords: 'log history events' },
    { id: 'nav-settings', category: 'Navigation', label: 'Settings', icon: <NavIcon />, action: () => { onNavigate('settings'); onClose() }, keywords: 'config preferences' },
    { id: 'nav-docs', category: 'Navigation', label: 'Documentation', icon: <NavIcon />, action: () => { onNavigate('docs'); onClose() }, keywords: 'help docs guide' },
    // Sessions
    ...sessions.map(s => ({
      id: `session-${s.id}`,
      category: 'Active Sessions',
      label: `${s.accountName}`,
      sublabel: `${s.roleName} · ${s.region}`,
      icon: <SessionIcon />,
      action: () => { onSelectSession(s); onNavigate('orbit'); onClose() },
      keywords: `${s.accountId} ${s.profileName} ${s.roleName}`,
    })),
    // Clusters
    ...clusters.map(c => ({
      id: `cluster-${c.name}`,
      category: 'Clusters',
      label: c.name,
      sublabel: c.region,
      icon: <ClusterIcon />,
      action: () => { onNavigate('clusters'); onClose() },
      keywords: `${c.arn} ${c.version}`,
    })),
  ], [sessions, clusters, onNavigate, onSelectSession, onClose])

  const filtered = useMemo(() => {
    if (!query.trim()) return allItems
    const q = query.toLowerCase()
    return allItems.filter(item =>
      item.label.toLowerCase().includes(q) ||
      (item.sublabel?.toLowerCase().includes(q)) ||
      (item.keywords?.toLowerCase().includes(q)) ||
      item.category.toLowerCase().includes(q)
    )
  }, [allItems, query])

  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>()
    for (const item of filtered) {
      if (!map.has(item.category)) map.set(item.category, [])
      map.get(item.category)!.push(item)
    }
    return map
  }, [filtered])

  useEffect(() => { setSelectedIndex(0) }, [query])

  useEffect(() => {
    if (!open) return
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, filtered.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        filtered[selectedIndex]?.action()
      }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [open, filtered, selectedIndex, onClose])

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  let flatIndex = 0

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
          <motion.div
            className="absolute inset-0 bg-bg-base/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="relative w-full max-w-xl mx-4 bg-bg-elevated border border-border rounded-2xl shadow-2xl shadow-black/60 overflow-hidden"
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <svg className="w-4 h-4 text-text-muted flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search accounts, clusters, commands..."
                className="flex-1 bg-transparent outline-none text-text-primary placeholder-text-muted text-sm font-ui"
              />
              <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 bg-bg-surface border border-border rounded text-text-muted text-xs font-mono">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-80 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-4 py-8 text-center text-text-muted text-sm">No results found</div>
              ) : (
                Array.from(grouped.entries()).map(([category, items]) => (
                  <div key={category}>
                    <div className="px-4 pt-3 pb-1 text-[10px] font-semibold text-text-muted uppercase tracking-widest">
                      {category}
                    </div>
                    {items.map(item => {
                      const idx = flatIndex++
                      return (
                        <button
                          key={item.id}
                          data-idx={idx}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                            selectedIndex === idx ? 'bg-bg-surface2' : 'hover:bg-bg-surface'
                          }`}
                          onClick={item.action}
                          onMouseEnter={() => setSelectedIndex(idx)}
                        >
                          <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-bg-surface flex items-center justify-center">
                            {item.icon}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-text-primary text-sm truncate">{item.label}</span>
                            {item.sublabel && (
                              <span className="block text-text-muted text-xs truncate">{item.sublabel}</span>
                            )}
                          </span>
                          {selectedIndex === idx && (
                            <kbd className="flex-shrink-0 px-1.5 py-0.5 bg-bg-overlay border border-border rounded text-text-muted text-xs font-mono">
                              ↵
                            </kbd>
                          )}
                        </button>
                      )
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-border flex items-center gap-3 text-text-muted text-xs">
              <span className="flex items-center gap-1"><kbd className="px-1 bg-bg-surface border border-border rounded font-mono">↑↓</kbd> navigate</span>
              <span className="flex items-center gap-1"><kbd className="px-1 bg-bg-surface border border-border rounded font-mono">↵</kbd> select</span>
              <span className="flex items-center gap-1"><kbd className="px-1 bg-bg-surface border border-border rounded font-mono">ESC</kbd> close</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export default CommandPalette
