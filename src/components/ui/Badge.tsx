import React from 'react'
import type { EnvType, MethodType, SessionStatus, CustomTag } from '@/types'

// ── Env Badge ─────────────────────────────────────────────────────────────────

const envConfig: Record<EnvType, { label: string; className: string }> = {
  prod:    { label: 'PROD',    className: 'bg-danger/10 text-danger border border-danger/30' },
  staging: { label: 'STAGING', className: 'bg-warning/10 text-warning border border-warning/30' },
  dev:     { label: 'DEV',     className: 'bg-success/10 text-success border border-success/30' },
  sandbox: { label: 'SANDBOX', className: 'bg-info/10 text-info border border-info/30' },
  unknown: { label: 'UNKNOWN', className: 'bg-text-muted/10 text-text-muted border border-text-muted/30' },
}

export function EnvBadge({ env }: { env: EnvType }) {
  const cfg = envConfig[env]
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}

/**
 * Clickable env badge with a popover menu for manual tagging. Used in lists
 * where `detectEnv(accountName)` returned the wrong thing — e.g. account
 * names that don't encode the environment (`acme-root`, `platform`, …).
 *
 * If `custom` is provided, the badge renders with user-chosen label+color
 * instead of the canonical envConfig style. `overridden` renders a small
 * dot so the user sees the tag came from them, not auto-detection.
 * `onReset` clears both the env override and any custom tag.
 *
 * The popover is rendered with `position: fixed` and anchored to the
 * button's bounding rect — otherwise the parent accordion's
 * `overflow-hidden` clips the menu.
 */
export function EnvEditableBadge({ env, custom, overridden, onChange, onSetCustom, onReset }: {
  env: EnvType
  custom?: CustomTag
  overridden?: boolean
  onChange: (next: EnvType) => void
  onSetCustom?: (tag: CustomTag) => void
  onReset?: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const [coords, setCoords] = React.useState<{ left: number; top?: number; bottom?: number } | null>(null)
  const [customMode, setCustomMode] = React.useState(false)
  const [customLabel, setCustomLabel] = React.useState(custom?.label ?? '')
  const [customColor, setCustomColor] = React.useState(custom?.color ?? COLOR_PRESETS[0])
  const btnRef = React.useRef<HTMLButtonElement>(null)
  const menuRef = React.useRef<HTMLDivElement>(null)

  // Recompute coords on open / scroll / resize — the absolute screen position
  // changes whenever the accordion scrolls or the window resizes.
  const updateCoords = React.useCallback(() => {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const vh = window.innerHeight
    if (vh - r.bottom - 8 < 240) {
      setCoords({ left: r.left, bottom: vh - r.top + 4 })
    } else {
      setCoords({ left: r.left, top: r.bottom + 4 })
    }
  }, [])

  React.useEffect(() => {
    if (!open) return
    updateCoords()
    const handle = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) { if (e.key === 'Escape') setOpen(false); return }
      const t = e.target as Node
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    window.addEventListener('mousedown', handle, true)
    window.addEventListener('keydown', handle)
    window.addEventListener('scroll', updateCoords, true)
    window.addEventListener('resize', updateCoords)
    return () => {
      window.removeEventListener('mousedown', handle, true)
      window.removeEventListener('keydown', handle)
      window.removeEventListener('scroll', updateCoords, true)
      window.removeEventListener('resize', updateCoords)
    }
  }, [open, updateCoords])

  // Reset the inline custom form state when popover closes.
  React.useEffect(() => {
    if (!open) { setCustomMode(false) }
  }, [open])

  const OPTIONS: EnvType[] = ['prod', 'staging', 'dev', 'sandbox', 'unknown']

  const badgeClass = custom
    ? 'relative inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider cursor-pointer hover:brightness-125 transition border'
    : `relative inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider cursor-pointer hover:brightness-125 transition ${envConfig[env].className}`

  const badgeStyle = custom
    ? { color: custom.color, borderColor: hexWithAlpha(custom.color, 0.4), background: hexWithAlpha(custom.color, 0.12) }
    : undefined

  const submitCustom = () => {
    const label = customLabel.trim().toUpperCase()
    if (!label || !onSetCustom) return
    onSetCustom({ label, color: customColor })
    setOpen(false)
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        className={badgeClass}
        style={badgeStyle}
        title={overridden ? 'Manually tagged — click to change' : 'Auto-detected — click to override'}
      >
        {custom ? custom.label : envConfig[env].label}
        {overridden && <span className="w-1 h-1 rounded-full bg-current opacity-70" />}
      </button>
      {open && coords && (
        <div
          ref={menuRef}
          className="fixed z-[100] bg-bg-elevated border border-border rounded-lg shadow-xl py-1 min-w-40"
          style={{ left: coords.left, ...(coords.top !== undefined ? { top: coords.top } : { bottom: coords.bottom }) }}
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
        >
          {!customMode ? (
            <>
              {OPTIONS.map(opt => (
                <button
                  key={opt}
                  onClick={() => { onChange(opt); setOpen(false) }}
                  className={`w-full text-left px-3 py-1 text-[10px] font-mono hover:bg-bg-surface flex items-center justify-between ${!custom && opt === env ? 'text-primary' : 'text-text-secondary'}`}
                >
                  {envConfig[opt].label}
                  {!custom && opt === env && (
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                  )}
                </button>
              ))}
              {onSetCustom && (
                <>
                  <div className="my-1 border-t border-border-subtle" />
                  <button
                    onClick={() => setCustomMode(true)}
                    className="w-full text-left px-3 py-1 text-[10px] font-mono text-text-secondary hover:bg-bg-surface flex items-center gap-1.5"
                  >
                    <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Custom…
                  </button>
                </>
              )}
              {overridden && onReset && (
                <>
                  <div className="my-1 border-t border-border-subtle" />
                  <button
                    onClick={() => { onReset(); setOpen(false) }}
                    className="w-full text-left px-3 py-1 text-[10px] text-text-muted hover:bg-bg-surface hover:text-text-primary"
                  >
                    Reset to auto
                  </button>
                </>
              )}
            </>
          ) : (
            <div className="p-2 min-w-56">
              <p className="text-[9px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">Custom tag</p>
              <input
                autoFocus
                type="text"
                value={customLabel}
                onChange={e => setCustomLabel(e.target.value.slice(0, 16))}
                onKeyDown={e => {
                  if (e.key === 'Enter') submitCustom()
                  if (e.key === 'Escape') { setCustomMode(false) }
                }}
                placeholder="e.g. QA, INFRA, …"
                className="w-full text-[11px] bg-bg-surface border border-border rounded px-2 py-1 outline-none focus:border-primary text-text-primary font-mono tracking-wider uppercase mb-2"
              />
              <div className="flex items-center gap-1.5 flex-wrap mb-2">
                {COLOR_PRESETS.map(c => (
                  <button
                    key={c}
                    onClick={() => setCustomColor(c)}
                    className={`w-4 h-4 rounded-full border transition ${customColor === c ? 'border-text-primary scale-110' : 'border-transparent hover:scale-110'}`}
                    style={{ background: c }}
                    title={c}
                  />
                ))}
              </div>
              <div
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider border mb-2"
                style={{ color: customColor, borderColor: hexWithAlpha(customColor, 0.4), background: hexWithAlpha(customColor, 0.12) }}
              >
                {customLabel.toUpperCase() || 'PREVIEW'}
              </div>
              <div className="flex gap-1 justify-end">
                <button
                  onClick={() => setCustomMode(false)}
                  className="text-[10px] px-2 py-1 rounded hover:bg-bg-surface text-text-muted"
                >Cancel</button>
                <button
                  onClick={submitCustom}
                  disabled={!customLabel.trim()}
                  className="text-[10px] px-2 py-1 rounded bg-primary/15 text-primary hover:bg-primary/25 disabled:opacity-40 disabled:cursor-not-allowed"
                >Apply</button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}

// ── Custom tag color palette ────────────────────────────────────────────────
const COLOR_PRESETS = [
  '#f87171', // red
  '#fbbf24', // amber
  '#34d399', // green
  '#60a5fa', // blue
  '#a78bfa', // violet
  '#f472b6', // pink
  '#22d3ee', // cyan
  '#94a3b8', // slate
]

// Inline helper — the badge tint uses the hex color with a low alpha for
// bg / border. Avoids adding a color library just for one op.
function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.startsWith('#') ? hex.slice(1) : hex
  if (h.length !== 6) return hex
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// ── Method Chip ───────────────────────────────────────────────────────────────

const methodConfig: Record<MethodType, { label: string; className: string }> = {
  sso:       { label: 'SSO',       className: 'bg-primary/10 text-primary border border-primary/30' },
  iam:       { label: 'IAM',       className: 'bg-warning/10 text-warning border border-warning/30' },
  federated: { label: 'FED',       className: 'bg-info/10 text-info border border-info/30' },
  chained:   { label: 'CHAIN',     className: 'bg-success/10 text-success border border-success/30' },
}

export function MethodChip({ method }: { method: MethodType }) {
  const cfg = methodConfig[method]
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}

// ── Status Chip ───────────────────────────────────────────────────────────────

const statusConfig: Record<SessionStatus, { label: string; className: string }> = {
  active:         { label: 'Active',        className: 'bg-success/10 text-success border border-success/30' },
  expiring:       { label: 'Expiring',      className: 'bg-warning/10 text-warning border border-warning/30' },
  expired:        { label: 'Expired',       className: 'bg-danger/10 text-danger border border-danger/30' },
  idle:           { label: 'Idle',          className: 'bg-text-muted/10 text-text-muted border border-text-muted/30' },
  'requires-auth':{ label: 'Auth Required', className: 'bg-danger/10 text-danger border border-danger/30' },
}

export function StatusChip({ status }: { status: SessionStatus }) {
  const cfg = statusConfig[status]
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${cfg.className}`}>
      <span className={`w-1 h-1 rounded-full ${
        status === 'active' ? 'bg-success' :
        status === 'expiring' ? 'bg-warning pulse-warning' :
        status === 'expired' ? 'bg-danger' :
        'bg-text-muted'
      }`} />
      {cfg.label}
    </span>
  )
}
