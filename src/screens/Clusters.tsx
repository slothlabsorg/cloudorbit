import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Session, ClusterInfo } from '@/types'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { Callout } from '@/components/ui/Callout'
import Button from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'

interface ClustersProps {
  sessions: Session[]
  onActivateCluster: (cluster: ClusterInfo, session: Session) => Promise<void>
  onDetectClusters?: (session: Session) => Promise<void>
}

export function Clusters({ sessions, onActivateCluster, onDetectClusters }: ClustersProps) {
  const [detecting, setDetecting] = useState<string | null>(null)
  const [activating, setActivating] = useState<string | null>(null)
  const [confirmModal, setConfirmModal] = useState<{ cluster: ClusterInfo; session: Session } | null>(null)
  const [successModal, setSuccessModal] = useState<{ cluster: ClusterInfo } | null>(null)
  // Per-session detection error — rendered inline under the session header
  // when a list_eks_clusters call fails (auth denied, wrong region, etc.).
  const [detectErrors, setDetectErrors] = useState<Record<string, string>>({})

  // All clusters from all sessions
  const sessionClusters: { session: Session; cluster: ClusterInfo }[] = sessions.flatMap(s =>
    (s.clusters ?? []).map(c => ({ session: s, cluster: c }))
  )

  const activeSessions = sessions.filter(s => new Date(s.expiresAt).getTime() > Date.now())

  const handleDetect = async (session: Session) => {
    setDetecting(session.id)
    setDetectErrors(e => { const { [session.id]: _, ...rest } = e; return rest })
    try {
      await onDetectClusters?.(session)
    } catch (err) {
      setDetectErrors(e => ({ ...e, [session.id]: String(err) }))
    } finally {
      setDetecting(null)
    }
  }

  const handleActivateClick = (cluster: ClusterInfo, session: Session) => {
    // Prod safety check
    if (session.environment === 'prod') {
      setConfirmModal({ cluster, session })
    } else {
      doActivate(cluster, session)
    }
  }

  const doActivate = async (cluster: ClusterInfo, session: Session) => {
    setConfirmModal(null)
    setActivating(cluster.name)
    try {
      await onActivateCluster(cluster, session)
      setSuccessModal({ cluster })
    } finally {
      setActivating(null)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle flex-shrink-0">
        <div>
          <h1 className="font-display font-bold text-text-primary text-base">Clusters</h1>
          <p className="text-text-muted text-xs mt-0.5">
            {sessionClusters.length} cluster{sessionClusters.length !== 1 ? 's' : ''} discovered
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {activeSessions.length === 0 ? (
          <EmptyState
            variant="sleep"
            title="No active sessions"
            description="Start a cloud session first to discover clusters."
          />
        ) : (
          activeSessions.map(session => {
            const clusters = session.clusters ?? []
            const isDetecting = detecting === session.id
            return (
              <div key={session.id} className="bg-bg-elevated border border-border rounded-xl overflow-hidden">
                {/* Session header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      session.environment === 'prod' ? 'bg-danger' :
                      session.environment === 'staging' ? 'bg-warning' :
                      'bg-success'
                    }`} />
                    <span className="text-text-primary text-sm font-semibold">{session.accountName}</span>
                    <span className="text-text-muted text-xs">/ {session.roleName}</span>
                    <span className="text-text-muted text-xs font-mono">· {session.region}</span>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={isDetecting}
                    onClick={() => handleDetect(session)}
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                    </svg>
                    Detect Clusters
                  </Button>
                </div>

                {/* Detection error */}
                {detectErrors[session.id] && (
                  <div className="mx-4 mt-3 mb-1 px-3 py-2 rounded-lg bg-danger/10 border border-danger/30 text-xs">
                    <p className="text-danger font-semibold mb-1">Cluster detection failed</p>
                    <pre className="text-danger/80 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed">{detectErrors[session.id]}</pre>
                  </div>
                )}

                {/* Clusters list */}
                {isDetecting ? (
                  <div className="p-4 space-y-2">
                    {[1, 2].map(i => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton width={32} height={32} className="rounded-lg" />
                        <div className="flex-1 space-y-1">
                          <Skeleton height={12} className="w-3/4" />
                          <Skeleton height={10} className="w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : clusters.length === 0 ? (
                  <div className="px-4 py-6 text-center text-text-muted text-xs">
                    No clusters found. Click "Detect Clusters" to scan.
                  </div>
                ) : (
                  <div className="divide-y divide-border-subtle">
                    <AnimatePresence initial={false}>
                      {clusters.map((cluster, i) => (
                        <motion.div
                          key={cluster.name}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.04 }}
                          className="flex items-center gap-4 px-4 py-3 hover:bg-bg-surface transition-colors"
                        >
                          <div className="w-8 h-8 rounded-lg bg-bg-surface flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="3"/>
                              <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-text-primary text-sm font-medium truncate">{cluster.name}</span>
                              {cluster.version && (
                                <span className="text-[10px] text-text-muted bg-bg-surface border border-border px-1.5 py-0.5 rounded font-mono">
                                  v{cluster.version}
                                </span>
                              )}
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                cluster.status === 'ACTIVE' ? 'bg-success/10 text-success' : 'bg-text-muted/10 text-text-muted'
                              }`}>
                                {cluster.status}
                              </span>
                            </div>
                            <p className="text-text-muted text-xs truncate mt-0.5 font-mono">{cluster.arn}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {session.environment === 'prod' && (
                              <span className="text-[10px] text-warning flex items-center gap-1">
                                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                                </svg>
                                PROD
                              </span>
                            )}
                            <Button
                              variant={session.environment === 'prod' ? 'danger' : 'secondary'}
                              size="sm"
                              loading={activating === cluster.name}
                              onClick={() => handleActivateClick(cluster, session)}
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="5 12 12 5 19 12"/>
                                <polyline points="5 19 12 12 19 19"/>
                              </svg>
                              Activate
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Prod safety confirmation modal */}
      <Modal open={!!confirmModal} onClose={() => setConfirmModal(null)} title="Production Cluster Warning">
        {confirmModal && (
          <div className="space-y-4">
            <Callout variant="warning" title="Production Environment">
              You are about to activate a kubeconfig context for a <strong>production</strong> cluster.
              This will set <code className="font-mono text-warning">~/.kube/config</code> current-context to:
            </Callout>
            <div className="bg-bg-surface border border-border rounded-lg px-3 py-2">
              <p className="font-mono text-sm text-warning">{confirmModal.cluster.name}</p>
              <p className="text-text-muted text-xs mt-0.5">{confirmModal.session.accountName} · {confirmModal.cluster.region}</p>
            </div>
            <p className="text-text-secondary text-xs">
              All subsequent <code className="font-mono">kubectl</code> commands will target this cluster.
              Proceed with caution.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirmModal(null)}>Cancel</Button>
              <Button variant="danger" size="sm" onClick={() => doActivate(confirmModal.cluster, confirmModal.session)}>
                I understand, activate
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Success modal */}
      <Modal open={!!successModal} onClose={() => setSuccessModal(null)} title="Cluster Activated">
        {successModal && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 py-2">
              <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              </div>
              <div>
                <p className="text-text-primary font-semibold text-sm">{successModal.cluster.name}</p>
                <p className="text-success text-xs">kubeconfig updated successfully</p>
              </div>
            </div>
            <Callout variant="success">
              Run <code className="font-mono text-success">kubectl get nodes</code> to verify connectivity.
            </Callout>
            <div className="flex justify-end">
              <Button variant="primary" size="sm" onClick={() => setSuccessModal(null)}>Done</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default Clusters
