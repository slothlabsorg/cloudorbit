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
