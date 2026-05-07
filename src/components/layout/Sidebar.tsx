import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Screen, Session } from '@/types'

interface SidebarProps {
  screen: Screen
  onNavigate: (screen: Screen) => void
  collapsed: boolean
  onToggleCollapse: () => void
  activeSession?: Session | null
}

interface NavItem {
  id: Screen
  label: string
  icon: React.ReactNode
}

function IconOrbit() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>
      <ellipse cx="12" cy="12" rx="10" ry="4" strokeDasharray="2 2"/>
    </svg>
  )
}

function IconLayers() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 2 7 12 12 22 7 12 2"/>
      <polyline points="2 17 12 22 22 17"/>
      <polyline points="2 12 12 17 22 12"/>
    </svg>
  )
}

function IconKey() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
    </svg>
  )
}

function IconCloud() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/>
    </svg>
  )
}

function IconActivity() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  )
}

function IconSettings() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  )
}

function IconBook() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/>
      <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
    </svg>
  )
}

function IconHeart() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </svg>
  )
}

function IconAccounts() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
    </svg>
  )
}

function IconCollapse({ collapsed }: { collapsed: boolean }) {
  return (
    <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  )
}

const navItems: NavItem[] = [
  { id: 'orbit',    label: 'Orbit',      icon: <IconOrbit /> },
  { id: 'accounts', label: 'Accounts',   icon: <IconAccounts /> },
  { id: 'sessions', label: 'Sessions',   icon: <IconKey /> },
  { id: 'clusters', label: 'Clusters',   icon: <IconCloud /> },
  { id: 'activity', label: 'Activity',   icon: <IconActivity /> },
]

const bottomItems: NavItem[] = [
  { id: 'settings', label: 'Settings',   icon: <IconSettings /> },
  { id: 'docs',     label: 'Docs',       icon: <IconBook /> },
  { id: 'support',  label: 'Support us', icon: <IconHeart /> },
]

export function Sidebar({ screen, onNavigate, collapsed, onToggleCollapse, activeSession }: SidebarProps) {
  const w = collapsed ? 48 : 180

  return (
    <motion.div
      className="flex flex-col h-full bg-bg-elevated border-r border-border flex-shrink-0 overflow-hidden"
      animate={{ width: w }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Nav items */}
      <div className="flex-1 py-2 overflow-hidden">
        {navItems.map(item => (
          <NavButton key={item.id} item={item} active={screen === item.id} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </div>

      {/* Bottom items */}
      <div className="py-2 border-t border-border-subtle">
        {bottomItems.map(item => (
          <NavButton key={item.id} item={item} active={screen === item.id} collapsed={collapsed} onNavigate={onNavigate} />
        ))}

        {/* Active session pill */}
        <AnimatePresence>
          {activeSession && !collapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mx-2 mt-2 mb-1 bg-bg-surface rounded-lg px-2.5 py-2 overflow-hidden"
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-success flex-shrink-0" />
                <span className="text-[10px] text-success font-medium">Active</span>
              </div>
              <p className="text-text-secondary text-xs font-medium truncate">{activeSession.accountName}</p>
              <p className="text-text-muted text-[10px] truncate">{activeSession.roleName}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapse button */}
        <button
          onClick={onToggleCollapse}
          className="flex items-center gap-3 w-full px-3 py-2 text-text-muted hover:text-text-primary hover:bg-bg-surface transition-colors rounded-lg mx-1 mt-1"
          style={{ width: 'calc(100% - 8px)' }}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
            <IconCollapse collapsed={collapsed} />
          </span>
          {!collapsed && <span className="text-xs whitespace-nowrap">Collapse</span>}
        </button>
      </div>
    </motion.div>
  )
}

function NavButton({ item, active, collapsed, onNavigate }: {
  item: NavItem
  active: boolean
  collapsed: boolean
  onNavigate: (screen: Screen) => void
}) {
  const isSupport = item.id === 'support'
  return (
    <button
      onClick={() => onNavigate(item.id)}
      className={`flex items-center gap-3 w-full transition-colors rounded-lg mx-1 px-3 py-2 ${
        active
          ? isSupport ? 'bg-rose-500/10 text-rose-400' : 'bg-primary/10 text-primary'
          : isSupport
            ? 'text-rose-400/70 hover:text-rose-400 hover:bg-rose-500/10'
            : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface'
      }`}
      style={{ width: 'calc(100% - 8px)' }}
      title={collapsed ? item.label : undefined}
    >
      <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
        {item.icon}
      </span>
      {!collapsed && (
        <span className="text-sm font-medium whitespace-nowrap overflow-hidden">{item.label}</span>
      )}
      {active && !collapsed && (
        <span className={`ml-auto w-1 h-1 rounded-full flex-shrink-0 ${isSupport ? 'bg-rose-400' : 'bg-primary'}`} />
      )}
    </button>
  )
}

export default Sidebar
