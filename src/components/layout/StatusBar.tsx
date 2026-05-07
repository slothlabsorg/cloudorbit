import React from 'react'
import type { Session, ClusterInfo } from '@/types'
import { formatExpiry } from '@/lib/time'

interface StatusBarProps {
  activeSession?: Session | null
  activeCluster?: ClusterInfo | null
}

export function StatusBar({ activeSession, activeCluster }: StatusBarProps) {
  const expiry = activeSession ? formatExpiry(activeSession.expiresAt) : null

  return (
    <div className="h-7 flex items-center justify-between px-4 border-t border-border-subtle bg-bg-base flex-shrink-0 select-none">
      <div className="flex items-center gap-4">
        {activeSession ? (
          <>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${
                expiry?.status === 'expired' ? 'bg-danger' :
                expiry?.status === 'expiring' ? 'bg-warning pulse-warning' : 'bg-success'
              }`} />
              <span className="text-text-secondary text-[11px] font-medium">
                {activeSession.accountName}
              </span>
              <span className="text-text-muted text-[11px]">/</span>
              <span className="text-text-muted text-[11px]">{activeSession.roleName}</span>
            </div>
            <span className="text-text-muted text-[11px] font-mono">{activeSession.region}</span>
            {expiry && (
              <span className={`text-[11px] font-mono ${
                expiry.status === 'expired' ? 'text-danger' :
                expiry.status === 'expiring' ? 'text-warning' : 'text-text-muted'
              }`}>
                {expiry.label}
              </span>
            )}
          </>
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
        <span className="text-text-muted text-[11px]">CloudOrbit v0.1.0</span>
      </div>
    </div>
  )
}

export default StatusBar
