import React from 'react'
import { AnimatePresence } from 'framer-motion'
import type { Screen, Session, ClusterInfo, ActivityEvent } from '@/types'
import { Titlebar } from './Titlebar'
import { Sidebar } from './Sidebar'
import { StatusBar } from './StatusBar'
import { DetailPanel } from '@/components/ui/DetailPanel'

interface ShellProps {
  screen: Screen
  onNavigate: (screen: Screen) => void
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
  newsUnread?: number
  sessions: Session[]
  selectedSession: Session | null
  onCloseDetail: () => void
  onRenewSession: (session: Session) => void
  onOpenConsole: (session: Session) => void
  onActivateCluster: (cluster: ClusterInfo, session: Session) => void
  onDetectClusters?: (session: Session) => Promise<void>
  activeCluster: ClusterInfo | null
  activity: ActivityEvent[]
  children: React.ReactNode
}

export function Shell({
  screen, onNavigate, sidebarCollapsed, onToggleSidebar, newsUnread,
  sessions, selectedSession, onCloseDetail, onRenewSession, onOpenConsole,
  onActivateCluster, onDetectClusters, activeCluster, activity, children,
}: ShellProps) {
  const activeSessions = sessions.filter(s => new Date(s.expiresAt).getTime() > Date.now())

  // Get all clusters from sessions
  const allClusters: ClusterInfo[] = sessions.flatMap(s => s.clusters ?? [])

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Titlebar activeSessions={sessions} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          screen={screen}
          onNavigate={onNavigate}
          collapsed={sidebarCollapsed}
          onToggleCollapse={onToggleSidebar}
          activeSessions={activeSessions}
          newsUnread={newsUnread}
        />

        <div className="flex flex-1 overflow-hidden">
          {/* Main content */}
          <div className="flex-1 overflow-hidden">
            {children}
          </div>

          {/* Detail panel */}
          <AnimatePresence>
            {selectedSession && (
              <div className="w-72 flex-shrink-0 overflow-hidden">
                <DetailPanel
                  session={selectedSession}
                  clusters={allClusters}
                  activity={activity}
                  onClose={onCloseDetail}
                  onRenew={onRenewSession}
                  onConsole={onOpenConsole}
                  onActivateCluster={onActivateCluster}
                  onDetectClusters={onDetectClusters}
                />
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <StatusBar activeSessions={activeSessions} activeCluster={activeCluster} onNavigate={onNavigate} />
    </div>
  )
}

export default Shell
