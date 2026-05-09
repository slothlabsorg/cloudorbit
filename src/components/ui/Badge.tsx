import React from 'react'
import type { EnvType, MethodType, SessionStatus } from '@/types'

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
 * `overridden` renders a small dot on the badge so the user sees the tag
 * came from them, not auto-detection. `onReset` clears the override.
 */
export function EnvEditableBadge({ env, overridden, onChange, onReset }: {
  env: EnvType
  overridden?: boolean
  onChange: (next: EnvType) => void
  onReset?: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const cfg = envConfig[env]
  const ref = React.useRef<HTMLSpanElement>(null)

  React.useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])

  const OPTIONS: EnvType[] = ['prod', 'staging', 'dev', 'sandbox', 'unknown']

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        className={`relative inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider cursor-pointer hover:brightness-125 transition ${cfg.className}`}
        title={overridden ? 'Manually tagged — click to change' : 'Auto-detected — click to override'}
      >
        {cfg.label}
        {overridden && <span className="w-1 h-1 rounded-full bg-current opacity-70" />}
      </button>
      {open && (
        <div
          className="absolute z-50 top-full mt-1 left-0 bg-bg-elevated border border-border rounded-lg shadow-xl py-1 min-w-32"
          onClick={e => e.stopPropagation()}
        >
          {OPTIONS.map(opt => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setOpen(false) }}
              className={`w-full text-left px-3 py-1 text-[10px] font-mono hover:bg-bg-surface flex items-center justify-between ${opt === env ? 'text-primary' : 'text-text-secondary'}`}
            >
              {envConfig[opt].label}
              {opt === env && (
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              )}
            </button>
          ))}
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
        </div>
      )}
    </span>
  )
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
