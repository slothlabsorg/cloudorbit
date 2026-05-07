import React from 'react'
import type { Session } from '@/types'

interface TitlebarProps {
  activeSessions: Session[]
}

function AppLogo() {
  const [failed, setFailed] = React.useState(false)
  if (failed) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-primary">
        <circle cx="12" cy="12" r="3" fill="currentColor"/>
        <ellipse cx="12" cy="12" rx="10" ry="4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeDasharray="3 2"/>
      </svg>
    )
  }
  return (
    <img
      src="/images/app-icon.PNG"
      alt="CloudOrbit"
      width={22} height={22}
      className="rounded-md object-cover flex-shrink-0"
      onError={() => setFailed(true)}
    />
  )
}

export function Titlebar({ activeSessions }: TitlebarProps) {
  const expiringCount = activeSessions.filter(s => {
    const diffMin = (new Date(s.expiresAt).getTime() - Date.now()) / 60000
    return diffMin > 0 && diffMin < 30
  }).length

  const activeCount = activeSessions.filter(s => new Date(s.expiresAt).getTime() > Date.now()).length

  return (
    <div
      data-tauri-drag-region
      className="h-12 flex items-center px-4 border-b border-border-subtle bg-bg-base flex-shrink-0 select-none"
      style={{ paddingLeft: '80px' }}
    >
      {/* Center — brand */}
      <div className="flex-1 flex items-center justify-center gap-2">
        <AppLogo />
        <span className="font-display font-bold text-text-primary text-sm tracking-wide">CloudOrbit</span>
      </div>

      {/* Right — status */}
      <div className="flex items-center gap-3">
        {expiringCount > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-warning pulse-warning" />
            <span className="text-warning text-xs font-medium">{expiringCount} expiring</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${activeCount > 0 ? 'bg-success' : 'bg-text-muted'}`} />
          <span className="text-text-muted text-xs">{activeCount} active</span>
        </div>
      </div>
    </div>
  )
}

export default Titlebar
