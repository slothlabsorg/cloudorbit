import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Screen, Session, ClusterInfo } from '@/types'
import { formatExpiry } from '@/lib/time'
import { api } from '@/lib/tauri'
import pkg from '../../../package.json'

interface StatusBarProps {
  activeSessions: Session[]
  activeCluster?: ClusterInfo | null
  onNavigate: (screen: Screen) => void
}

export function StatusBar({ activeSessions, activeCluster, onNavigate }: StatusBarProps) {
  const count = activeSessions.length
  const [idx, setIdx] = React.useState(0)

  React.useEffect(() => { setIdx(0) }, [count])
  React.useEffect(() => {
    if (count <= 1) return
    const t = setInterval(() => setIdx(i => (i + 1) % count), 5000)
    return () => clearInterval(t)
  }, [count])

  const current = activeSessions[Math.min(idx, count - 1)] ?? null
  const expiry = current ? formatExpiry(current.expiresAt) : null

  return (
    <div className="h-7 flex items-center justify-between px-4 border-t border-border-subtle bg-bg-base flex-shrink-0 select-none">
      <div className="flex items-center gap-4">
        {current ? (
          <button
            onClick={() => onNavigate('sessions')}
            className="flex items-center gap-4 hover:opacity-70 transition-opacity"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-4"
              >
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    expiry?.status === 'expired' ? 'bg-danger' :
                    expiry?.status === 'expiring' ? 'bg-warning pulse-warning' : 'bg-success'
                  }`} />
                  {count > 1 && (
                    <span className="text-text-muted text-[11px] font-mono">{idx + 1}/{count}</span>
                  )}
                  <span className="text-text-secondary text-[11px] font-medium">
                    {current.accountName}
                  </span>
                  <span className="text-text-muted text-[11px]">/</span>
                  <span className="text-text-muted text-[11px]">{current.roleName}</span>
                </div>
                <span className="text-text-muted text-[11px] font-mono">{current.region}</span>
                {expiry && (
                  <span className={`text-[11px] font-mono ${
                    expiry.status === 'expired' ? 'text-danger' :
                    expiry.status === 'expiring' ? 'text-warning' : 'text-text-muted'
                  }`}>
                    {expiry.label}
                  </span>
                )}
              </motion.div>
            </AnimatePresence>
          </button>
        ) : (
          <span className="text-text-muted text-[11px]">No active session</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {activeCluster && (
          <div className="flex items-center gap-1.5">
            <svg className="w-3 h-3 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>
            </svg>
            <span className="text-text-secondary text-[11px] font-mono">{activeCluster.name}</span>
          </div>
        )}
        {/* SlothLabs attribution — always visible so users know where the app
            comes from and how to support it. Links use the opener plugin so
            the default browser handles them (not the Tauri webview). */}
        <span className="text-text-muted text-[11px] flex items-center gap-1">
          Made by{' '}
          <button
            onClick={() => api.openExternalUrl('https://slothlabs.org').catch(() => {})}
            className="text-text-secondary hover:text-primary transition-colors underline-offset-2 hover:underline"
            title="slothlabs.org"
          >
            SlothLabs
          </button>
          <span className="text-text-muted/50 px-0.5">·</span>
          <button
            onClick={() => api.openExternalUrl('https://ko-fi.com/slothlabs').catch(() => {})}
            className="text-text-muted hover:text-primary transition-colors"
            title="Support on Ko-fi"
          >
            ☕ Support
          </button>
        </span>
        <span className="text-text-muted/60 text-[11px] font-mono">v{pkg.version}</span>
      </div>
    </div>
  )
}

export default StatusBar
