import React, { useState, useEffect, useCallback } from 'react'
import type { Screen, Session, SsoGroup, ClusterInfo, ActivityEvent, Profile } from '@/types'
import { api } from '@/lib/tauri'
import { detectEnv } from '@/lib/time'
import { mockSessions, mockActivity } from '@/mock/data'
import { Shell } from '@/components/layout/Shell'
import { CommandPalette } from '@/components/ui/CommandPalette'
import { Orbit } from '@/screens/Orbit'
import { Accounts } from '@/screens/Accounts'
import { Sessions } from '@/screens/Sessions'
import { Clusters } from '@/screens/Clusters'
import { Activity } from '@/screens/Activity'
import { Settings } from '@/screens/Settings'
import { Docs } from '@/screens/Docs'
import { Support } from '@/screens/Support'
import { UpdaterModal } from '@/components/UpdaterModal'

interface LoginState {
  status: 'idle' | 'starting' | 'polling' | 'done' | 'error'
  clientId?: string
  clientSecret?: string
  deviceCode?: string
  interval?: number
  error?: string
}

let sessionIdCounter = 100

// Read URL params for dev/preview mode
function getUrlParam(key: string): string | null {
  try { return new URL(window.location.href).searchParams.get(key) } catch { return null }
}
const URL_SCREEN       = (getUrlParam('screen') as Screen | null) ?? 'orbit'
const URL_MOCK         = getUrlParam('mock') === '1'
const URL_DETAIL       = getUrlParam('detail') === '1'
const URL_PALETTE      = getUrlParam('palette') === '1'
const URL_FIRST_LAUNCH = getUrlParam('firstLaunch') === '1'
const URL_UPDATER      = getUrlParam('updater') === '1'

export default function App() {
  const [screen, setScreen] = useState<Screen>(URL_SCREEN)
  const [ssoGroups, setSsoGroups] = useState<SsoGroup[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(URL_PALETTE)
  const [isLoading, setIsLoading] = useState(true)
  const [loginState, setLoginState] = useState<Record<string, LoginState>>({})
  const [activity, setActivity] = useState<ActivityEvent[]>(URL_MOCK ? mockActivity : [])
  const [activeCluster, setActiveCluster] = useState<ClusterInfo | null>(null)

  // Load config on mount
  useEffect(() => {
    const load = async () => {
      // ?firstLaunch=1 → simulate empty first-run state
      if (URL_FIRST_LAUNCH) {
        setSsoGroups([])
        setSessions([])
        setIsLoading(false)
        return
      }

      // ?mock=1 → skip Tauri, load instantly
      if (URL_MOCK) {
        setSsoGroups([{
          startUrl: 'https://acme.awsapps.com/start',
          ssoRegion: 'us-east-1',
          profiles: mockSessions.map(s => ({
            name: s.accountName,
            startUrl: s.startUrl,
            ssoRegion: s.ssoRegion,
            accountId: s.accountId,
            roleName: s.roleName,
            region: s.region,
          })),
        }])
        setSessions(mockSessions)
        if (URL_DETAIL) setSelectedSession(mockSessions[0])
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const config = await api.parseConfig()
        setSsoGroups(config.ssoGroups)
      } catch (err) {
        // Not in Tauri or error — fall back to mock data
        console.warn('parse_config failed, using mock data:', err)
        setSsoGroups([{
          startUrl: 'https://acme.awsapps.com/start',
          ssoRegion: 'us-east-1',
          profiles: mockSessions.map(s => ({
            name: s.accountName,
            startUrl: s.startUrl,
            ssoRegion: s.ssoRegion,
            accountId: s.accountId,
            roleName: s.roleName,
            region: s.region,
          })),
        }])
        setSessions(mockSessions)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  // ⌘K command palette
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(v => !v)
      }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [])

  // Add activity event helper
  const addActivity = useCallback((event: Omit<ActivityEvent, 'id' | 'time'>) => {
    setActivity(prev => [{
      ...event,
      id: `ev-${Date.now()}`,
      time: new Date(),
    }, ...prev])
  }, [])

  // Start a session from a profile
  const handleStartSession = useCallback(async (profile: Profile): Promise<void> => {
    if (!profile.accountId || !profile.roleName) {
      throw new Error('Profile has no account ID or role name')
    }

    const key = `${profile.accountId}-${profile.roleName}`

    // Check if SSO login is needed
    const isLoggedIn = await api.checkSsoLogin(profile.startUrl)
    if (!isLoggedIn) {
      // Start SSO login flow
      setLoginState(prev => ({ ...prev, [key]: { status: 'starting' } }))
      const loginInfo = await api.ssoLoginStart(profile.startUrl, profile.ssoRegion)

      setLoginState(prev => ({
        ...prev,
        [key]: {
          status: 'polling',
          clientId: loginInfo.clientId,
          clientSecret: loginInfo.clientSecret,
          deviceCode: loginInfo.deviceCode,
          interval: loginInfo.interval,
        },
      }))

      // Poll for token
      let done = false
      while (!done) {
        await new Promise(r => setTimeout(r, (loginInfo.interval + 1) * 1000))
        const result = await api.ssoLoginPoll(
          loginInfo.clientId,
          loginInfo.clientSecret,
          loginInfo.deviceCode,
          profile.startUrl,
          profile.ssoRegion,
        )
        if (result.success) {
          done = true
          setLoginState(prev => ({ ...prev, [key]: { status: 'done' } }))
          addActivity({ type: 'reauth', title: 'SSO login completed', reference: profile.name })
        } else if (!result.pending) {
          setLoginState(prev => ({ ...prev, [key]: { status: 'error', error: result.error } }))
          throw new Error(result.error ?? 'SSO login failed')
        }
      }
    }

    // Assume the role
    const creds = await api.assumeRole(
      profile.startUrl,
      profile.ssoRegion,
      profile.accountId,
      profile.roleName,
    )

    const newSession: Session = {
      id: String(++sessionIdCounter),
      accountId: creds.accountId,
      accountName: profile.name || `${profile.accountId}-${profile.roleName}`,
      roleName: creds.roleName,
      startUrl: profile.startUrl,
      ssoRegion: profile.ssoRegion,
      region: profile.region,
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
      expiresAt: creds.expiresAt ?? new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
      profileName: creds.profileName,
      method: 'sso',
      environment: detectEnv(profile.name),
      isFavorite: false,
      clusters: [],
    }

    setSessions(prev => {
      // Replace existing session for same account+role
      const filtered = prev.filter(s => !(s.accountId === newSession.accountId && s.roleName === newSession.roleName))
      return [...filtered, newSession]
    })

    addActivity({ type: 'session-start', title: 'Session started', reference: `${newSession.accountName} / ${newSession.roleName}`, method: 'sso' })
    setSelectedSession(newSession)
    setLoginState(prev => {
      const updated = { ...prev }
      delete updated[key]
      return updated
    })
  }, [addActivity])

  // Renew session
  const handleRenewSession = useCallback(async (session: Session) => {
    const profile: Profile = {
      name: session.accountName,
      startUrl: session.startUrl,
      ssoRegion: session.ssoRegion,
      accountId: session.accountId,
      roleName: session.roleName,
      region: session.region,
    }
    try {
      await handleStartSession(profile)
      addActivity({ type: 'session-renew', title: 'Session renewed', reference: `${session.accountName} / ${session.roleName}`, method: session.method })
    } catch (err) {
      console.error('Renew failed:', err)
    }
  }, [handleStartSession, addActivity])

  // Open AWS console
  const handleOpenConsole = useCallback(async (session: Session) => {
    try {
      await api.openWebConsole(
        session.accessKeyId,
        session.secretAccessKey,
        session.sessionToken,
        session.region,
      )
    } catch (err) {
      console.warn('open_web_console failed (not in Tauri?):', err)
    }
  }, [])

  // Activate cluster
  const handleActivateCluster = useCallback(async (cluster: ClusterInfo, session: Session) => {
    try {
      await api.updateKubeconfig(cluster, session.profileName)
      setActiveCluster(cluster)
      // Update session clusters
      setSessions(prev => prev.map(s => {
        if (s.id !== session.id) return s
        const existing = s.clusters ?? []
        const alreadyHas = existing.some(c => c.name === cluster.name)
        return { ...s, clusters: alreadyHas ? existing : [...existing, cluster] }
      }))
      addActivity({ type: 'cluster-activate', title: 'Cluster activated', reference: cluster.name })
      addActivity({ type: 'kubeconfig-update', title: 'kubeconfig updated', reference: `~/.kube/config → ${cluster.name}` })
    } catch (err) {
      console.warn('update_kubeconfig failed (not in Tauri?):', err)
      // Still update UI in dev mode
      setActiveCluster(cluster)
      addActivity({ type: 'cluster-activate', title: 'Cluster activated (mock)', reference: cluster.name })
    }
  }, [addActivity])

  // Detect clusters for a session
  const handleDetectClusters = useCallback(async (session: Session) => {
    try {
      const found = await api.listEksClusters(
        session.region,
        session.accessKeyId,
        session.secretAccessKey,
        session.sessionToken,
      )
      setSessions(prev => prev.map(s =>
        s.id === session.id ? { ...s, clusters: found } : s
      ))
      if (found.length > 0) {
        addActivity({ type: 'cluster-activate', title: `${found.length} cluster${found.length !== 1 ? 's' : ''} discovered`, reference: session.accountName })
      }
    } catch (err) {
      console.warn('list_eks_clusters failed (not in Tauri?):', err)
    }
  }, [addActivity])

  // Add a new SSO connection from the wizard
  const handleAddConnection = useCallback((group: SsoGroup) => {
    setSsoGroups(prev => {
      const existing = prev.find(g => g.startUrl === group.startUrl)
      if (existing) {
        return prev.map(g =>
          g.startUrl === group.startUrl
            ? { ...g, profiles: [...g.profiles, ...group.profiles.filter(p => !g.profiles.some(ep => ep.name === p.name))] }
            : g
        )
      }
      return [...prev, group]
    })
    addActivity({ type: 'session-start', title: 'Connection added', reference: group.profiles[0]?.name ?? group.startUrl })
  }, [addActivity])

  // All clusters from all sessions
  const allClusters: ClusterInfo[] = sessions.flatMap(s => s.clusters ?? [])

  const renderScreen = () => {
    switch (screen) {
      case 'orbit':
        return (
          <Orbit
            sessions={sessions}
            ssoGroups={ssoGroups}
            isLoading={isLoading}
            onSelectSession={setSelectedSession}
            onStartSession={handleStartSession}
            selectedSession={selectedSession}
            onAddConnection={() => setScreen('accounts')}
            onNavigate={setScreen}
          />
        )
      case 'accounts':
        return (
          <Accounts
            sessions={sessions}
            ssoGroups={ssoGroups}
            isLoading={isLoading}
            selectedSession={selectedSession}
            onSelectSession={setSelectedSession}
            onStartSession={handleStartSession}
            onAddConnection={handleAddConnection}
          />
        )
      case 'sessions':
        return (
          <Sessions
            sessions={sessions}
            isLoading={isLoading}
            selectedSession={selectedSession}
            onSelectSession={setSelectedSession}
            onOpenConsole={handleOpenConsole}
            onRenewSession={handleRenewSession}
          />
        )
      case 'clusters':
        return (
          <Clusters
            sessions={sessions}
            onActivateCluster={handleActivateCluster}
            onDetectClusters={handleDetectClusters}
          />
        )
      case 'activity':
        return <Activity events={activity} />
      case 'settings':
        return <Settings />
      case 'docs':
        return <Docs />
      case 'support':
        return <Support />
      default:
        return null
    }
  }

  return (
    <>
      <Shell
        screen={screen}
        onNavigate={setScreen}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed(v => !v)}
        sessions={sessions}
        selectedSession={selectedSession}
        onCloseDetail={() => setSelectedSession(null)}
        onRenewSession={handleRenewSession}
        onOpenConsole={handleOpenConsole}
        onActivateCluster={handleActivateCluster}
        activeCluster={activeCluster}
        activity={activity}
      >
        {renderScreen()}
      </Shell>

      {(!URL_MOCK || URL_UPDATER) && <UpdaterModal />}

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        sessions={sessions}
        clusters={allClusters}
        onNavigate={screen => { setScreen(screen); setCommandPaletteOpen(false) }}
        onSelectSession={session => { setSelectedSession(session); setCommandPaletteOpen(false) }}
        onStartSession={handleStartSession}
      />
    </>
  )
}
