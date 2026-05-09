import React from 'react'
import type { Session } from '@/types'
import { getCurrentWindow } from '@tauri-apps/api/window'

interface TitlebarProps {
  activeSessions: Session[]
}

// macOS renders traffic lights (close/min/max) at top-left ~12–72px when the
// window uses `titleBarStyle: "Overlay"`. We reserve 80px there so our content
// doesn't sit underneath. Windows/Linux have no overlay; native decorations
// render their own titlebar above our content, so we don't need left padding.
const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)

// `data-tauri-drag-region` + CSS `-webkit-app-region: drag` alone don't
// reliably move the window on Tauri 2 macOS with `titleBarStyle: Overlay`
// (the CSS property is a no-op on WebKit and the attribute handler sometimes
// doesn't bind). Calling `startDragging()` from a mousedown handler is the
// documented reliable path. We skip interactive children so they keep
// receiving clicks.
function startDragOnMouseDown(e: React.MouseEvent) {
  if (e.button !== 0) return
  const target = e.target as HTMLElement
  if (target.closest('button, a, input, select, textarea, [role="button"]')) return
  try {
    const win = getCurrentWindow()
    // Fire and forget — failure in browser dev mode is expected.
    void win.startDragging()
  } catch {
    /* not in Tauri runtime */
  }
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

// ── Windows/Linux window controls ───────────────────────────────────────────
// Rendered only when we've disabled native decorations (Win/Linux overrides in
// tauri.<platform>.conf.json). macOS keeps traffic lights from the Overlay
// titleBarStyle and skips this row.
function WindowControls() {
  const min = () => { void getCurrentWindow().minimize().catch(() => {}) }
  const max = () => { void getCurrentWindow().toggleMaximize().catch(() => {}) }
  const close = () => { void getCurrentWindow().close().catch(() => {}) }
  return (
    <div className="flex items-center ml-3 -mr-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      <button
        onClick={min}
        aria-label="Minimize"
        className="w-10 h-12 flex items-center justify-center text-text-muted hover:bg-bg-surface hover:text-text-primary transition-colors"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M0 5h10" stroke="currentColor" strokeWidth="1"/></svg>
      </button>
      <button
        onClick={max}
        aria-label="Maximize"
        className="w-10 h-12 flex items-center justify-center text-text-muted hover:bg-bg-surface hover:text-text-primary transition-colors"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1"/></svg>
      </button>
      <button
        onClick={close}
        aria-label="Close"
        className="w-10 h-12 flex items-center justify-center text-text-muted hover:bg-danger hover:text-white transition-colors"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M0 0l10 10M10 0L0 10" stroke="currentColor" strokeWidth="1"/></svg>
      </button>
    </div>
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
      onMouseDown={startDragOnMouseDown}
      className="h-12 flex items-center px-4 border-b border-border-subtle bg-bg-base flex-shrink-0 select-none"
      style={IS_MAC ? { paddingLeft: '80px' } : undefined}
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

      {/* Win/Linux window buttons (decorations: false) */}
      {!IS_MAC && <WindowControls />}
    </div>
  )
}

export default Titlebar
