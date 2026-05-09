import React from 'react'
import { motion } from 'framer-motion'
import type { Session, ClusterInfo, ActivityEvent } from '@/types'
import { formatExpiry, timeAgo } from '@/lib/time'
import { EnvBadge, MethodChip, StatusChip } from './Badge'
import { ProgressBar } from './ProgressBar'
import { StatusDot } from './StatusDot'
import Button from './Button'

interface DetailPanelProps {
  session: Session
  clusters: ClusterInfo[]
  activity: ActivityEvent[]
  onClose: () => void
  onRenew: (session: Session) => void
  onConsole: (session: Session) => void
  onActivateCluster: (cluster: ClusterInfo, session: Session) => void
  onDetectClusters?: (session: Session) => Promise<void>
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false)
  const copy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button onClick={copy} className="text-text-muted hover:text-primary transition-colors p-0.5 rounded">
      {copied ? (
        <svg className="w-3 h-3 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
      ) : (
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
        </svg>
      )}
    </button>
  )
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-border-subtle last:border-0">
      <span className="text-text-muted text-xs flex-shrink-0">{label}</span>
      <div className="flex items-center gap-1 min-w-0">
        <span className={`text-text-secondary text-xs truncate ${mono ? 'font-mono' : ''}`}>{value}</span>
        <CopyButton value={value} />
      </div>
    </div>
  )
}

export function DetailPanel({ session, clusters, activity, onClose, onRenew, onConsole, onActivateCluster, onDetectClusters }: DetailPanelProps) {
  const { label: expiryLabel, status: expiryStatus } = formatExpiry(session.expiresAt)
  const sessionStatus = expiryStatus === 'expired' ? 'expired' : expiryStatus === 'expiring' ? 'expiring' : 'active'
  const [detecting, setDetecting] = React.useState(false)
  const [detectError, setDetectError] = React.useState<string | null>(null)

  const sessionClusters = clusters.filter(c =>
    session.clusters?.some(sc => sc.name === c.name) ||
    c.arn.includes(session.accountId)
  )

  const runDetect = async () => {
    if (!onDetectClusters) return
    setDetecting(true); setDetectError(null)
    try { await onDetectClusters(session) }
    catch (e) { setDetectError(String(e)) }
    finally { setDetecting(false) }
  }

  const sessionActivity = activity.filter(a =>
    a.reference.includes(session.accountName) || a.reference.includes(session.accountId)
  ).slice(0, 4)

  return (
    <motion.div
      className="flex flex-col h-full bg-bg-elevated border-l border-border overflow-hidden"
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 20, opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <StatusDot status={sessionStatus} size="sm" />
          <h3 className="text-text-primary font-semibold text-sm truncate">{session.accountName}</h3>
        </div>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors p-1 rounded-lg hover:bg-bg-surface flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Status + expiry */}
        <div className="px-4 py-3 border-b border-border-subtle">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <EnvBadge env={session.environment} />
              <MethodChip method={session.method} />
            </div>
            <StatusChip status={sessionStatus} />
          </div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-text-muted">Expires in</span>
            <span className={`font-mono font-medium ${
              expiryStatus === 'expired' ? 'text-danger' :
              expiryStatus === 'expiring' ? 'text-warning' : 'text-success'
            }`}>{expiryLabel}</span>
          </div>
          <ProgressBar expiresAt={session.expiresAt} />
        </div>

        {/* Account info */}
        <div className="px-4 py-3 border-b border-border-subtle">
          <p className="text-text-muted text-[10px] font-semibold uppercase tracking-wider mb-2">Account</p>
          <InfoRow label="Account ID" value={session.accountId} mono />
          <InfoRow label="Role" value={session.roleName} />
          <InfoRow label="Region" value={session.region} mono />
          <InfoRow label="Profile" value={session.profileName} mono />
        </div>

        {/* Credentials (masked) */}
        <div className="px-4 py-3 border-b border-border-subtle">
          <p className="text-text-muted text-[10px] font-semibold uppercase tracking-wider mb-2">Credentials</p>
          <InfoRow label="Access Key" value={`${session.accessKeyId.slice(0, 4)}...${session.accessKeyId.slice(-4)}`} mono />
          <InfoRow label="SSO Region" value={session.ssoRegion} mono />
        </div>

        {/* Clusters */}
        <div className="px-4 py-3 border-b border-border-subtle">
          <div className="flex items-center justify-between mb-2">
            <p className="text-text-muted text-[10px] font-semibold uppercase tracking-wider">
              EKS Clusters ({sessionClusters.length})
            </p>
            {onDetectClusters && (
              <button
                onClick={runDetect}
                disabled={detecting}
                className="text-[10px] text-primary hover:text-blue-300 transition-colors disabled:opacity-50"
              >
                {detecting ? 'Detecting…' : sessionClusters.length === 0 ? 'Detect' : 'Refresh'}
              </button>
            )}
          </div>
          {detectError && (
            <pre className="mb-2 bg-danger/10 border border-danger/30 rounded-lg px-2 py-1.5 text-danger/90 text-[10px] whitespace-pre-wrap break-words font-mono leading-relaxed">
              {detectError}
            </pre>
          )}
          {sessionClusters.length === 0 ? (
            <p className="text-text-muted text-[11px] py-1">No clusters detected yet.</p>
          ) : (
            <div className="space-y-1.5">
              {sessionClusters.map(cluster => (
                <div key={cluster.name} className="flex items-center justify-between gap-2 bg-bg-surface rounded-lg px-2.5 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cluster.status === 'ACTIVE' ? 'bg-success' : 'bg-text-muted'}`} />
                    <div className="min-w-0">
                      <p className="text-text-primary text-xs truncate font-medium">{cluster.name}</p>
                      <p className="text-text-muted text-[10px]">{cluster.region} {cluster.version && `· v${cluster.version}`}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onActivateCluster(cluster, session)}
                    className="text-[10px] text-primary hover:text-blue-300 transition-colors flex-shrink-0 px-2 py-1 rounded bg-primary/10 hover:bg-primary/20"
                  >
                    Activate
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent activity */}
        {sessionActivity.length > 0 && (
          <div className="px-4 py-3">
            <p className="text-text-muted text-[10px] font-semibold uppercase tracking-wider mb-2">Recent Activity</p>
            <div className="space-y-2">
              {sessionActivity.map(event => (
                <div key={event.id} className="flex items-start gap-2">
                  <div className="w-1 h-1 rounded-full bg-text-muted mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-text-secondary text-xs">{event.title}</p>
                    <p className="text-text-muted text-[10px]">{timeAgo(event.time)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-3 border-t border-border flex gap-2 flex-shrink-0">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          onClick={() => onRenew(session)}
          disabled={sessionStatus === 'active'}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 4v6h-6M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
          </svg>
          Renew
        </Button>
        <Button
          variant="primary"
          size="sm"
          className="flex-1"
          onClick={() => onConsole(session)}
          disabled={sessionStatus === 'expired'}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          Console
        </Button>
      </div>
    </motion.div>
  )
}

export default DetailPanel
