import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { Screen, Session, SsoGroup, ClusterInfo, ActivityEvent, Profile } from '@/types'
import { toMeta, type SessionMeta } from '@/lib/session'
import { api } from '@/lib/tauri'
import { detectEnv, resolveEnv, envOverrideKey, accountNameFrom } from '@/lib/time'
import type { EnvType, CustomTag } from '@/types'
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
import { UpdaterModal, type UpdaterModalHandle } from '@/components/UpdaterModal'
import { News } from '@/screens/News'
import { loadNews, markRead, getUnreadIds } from '@/lib/news'
import { MOCK_FEED } from '@/data/news-mock'
import type { NewsItem } from '@/types/news'

interface LoginState {
  status: 'idle' | 'starting' | 'polling' | 'done' | 'error'
  clientId?: string
  clientSecret?: string
  deviceCode?: string
  interval?: number
  error?: string
}

let sessionIdCounter = 100

// ── SSO aliases — persisted mapping of startUrl → alias ────────────────────
// AWS config (`~/.aws/config`) has no place to store a user-given alias, so
// we keep them in localStorage and merge on load / update.
const ALIAS_STORAGE_KEY = 'cloudorbit.ssoAliases'
function readAliases(): Record<string, string> {
  try {
    const raw = localStorage.getItem(ALIAS_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}
function writeAliases(aliases: Record<string, string>) {
  try { localStorage.setItem(ALIAS_STORAGE_KEY, JSON.stringify(aliases)) } catch { /* quota */ }
}

// ── Account aliases — persisted mapping of `${startUrl}|${accountId}` → alias
// Lets users give a friendly name to any individual account, overriding the
// AWS account name (e.g. "AWS_Dev_DevNextDeveloper-xxxxx" → "My Dev").
const ACCOUNT_ALIAS_KEY = 'cloudorbit.accountAliases'
function readAccountAliases(): Record<string, string> {
  try {
    const raw = localStorage.getItem(ACCOUNT_ALIAS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}
function writeAccountAliases(aliases: Record<string, string>) {
  try { localStorage.setItem(ACCOUNT_ALIAS_KEY, JSON.stringify(aliases)) } catch { /* quota */ }
}

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
const URL_NEWS         = getUrlParam('news') === '1'
const URL_MOCK_NEWS    = getUrlParam('mockNews') === '1' || URL_NEWS
const URL_MOCK_UPDATE  = getUrlParam('mockUpdate') === '1'
const URL_MOCK_UPDATE_VER = getUrlParam('mockUpdateVersion') ?? '1.1.0'

const MOCK_NEWS_INFO = {
  version: '1.1.0',
  body: `## What's new in v1.1.0\n\n- Session persistence across restarts\n- Region selector when starting sessions\n- IAM / Chained / Federated auth backends\n- Sidebar cycles all active sessions\n- Environment tag dropdown no longer clips on last row\n- Credentials file now includes selected region`,
}

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
  const updaterRef = useRef<UpdaterModalHandle>(null)
  const [updateInfo, setUpdateInfo] = useState<{ version: string; body: string | null } | null>(
    URL_NEWS ? MOCK_NEWS_INFO : URL_MOCK_UPDATE ? { version: URL_MOCK_UPDATE_VER, body: null } : null
  )
  const [updaterDismissed, setUpdaterDismissed] = useState(() => {
    const v = URL_MOCK_UPDATE ? URL_MOCK_UPDATE_VER : ''
    if (!v) return false
    try { return localStorage.getItem('cloudorbit.updaterDismissed') === v } catch { return false }
  })
  const validItems = MOCK_FEED.items.filter(i => !i.expiresAt || new Date(i.expiresAt).getTime() > Date.now())
  const [newsItems, setNewsItems] = useState<NewsItem[]>(() => URL_MOCK_NEWS ? validItems : [])
  const [newsUnread, setNewsUnread] = useState(() =>
    URL_MOCK_NEWS ? getUnreadIds(validItems).length : 0
  )

  // ── Favorites ─────────────────────────────────────────────────────────────
  // Role-level favorites, keyed by `${startUrl}|${accountId}|${roleName}` so
  // they survive across SSO connections. Persisted to localStorage so the
  // list sticks between app launches (unlike Session.isFavorite, which is
  // ephemeral and resets when a session expires).
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('cloudorbit.favorites')
      return new Set<string>(raw ? JSON.parse(raw) : [])
    } catch { return new Set() }
  })
  useEffect(() => {
    try { localStorage.setItem('cloudorbit.favorites', JSON.stringify(Array.from(favorites))) } catch { /* quota — ignore */ }
  }, [favorites])
  const toggleFavorite = useCallback((key: string) => {
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }, [])

  // ── Env overrides ─────────────────────────────────────────────────────────
  // User-supplied env tags that take precedence over name-based detection.
  // Keyed by `${startUrl}|${accountId}` so the override survives session
  // renewals and applies to every role under that account.
  const [envOverrides, setEnvOverrides] = useState<Record<string, EnvType>>(() => {
    try {
      const raw = localStorage.getItem('cloudorbit.envOverrides')
      return raw ? JSON.parse(raw) : {}
    } catch { return {} }
  })
  useEffect(() => {
    try { localStorage.setItem('cloudorbit.envOverrides', JSON.stringify(envOverrides)) } catch { /* quota */ }
  }, [envOverrides])
  const setEnvOverride = useCallback((startUrl: string, accountId: string, env: EnvType | null) => {
    const key = envOverrideKey(startUrl, accountId)
    setEnvOverrides(prev => {
      const next = { ...prev }
      if (env === null) delete next[key]
      else next[key] = env
      return next
    })
    // Also patch any live Session objects for this account so the badge
    // re-renders immediately without waiting for a new session start.
    setSessions(prev => prev.map(s =>
      s.startUrl === startUrl && s.accountId === accountId
        ? { ...s, environment: env ?? detectEnv(s.accountName) }
        : s
    ))
    setSelectedSession(prev =>
      prev && prev.startUrl === startUrl && prev.accountId === accountId
        ? { ...prev, environment: env ?? detectEnv(prev.accountName) }
        : prev
    )
  }, [])

  // ── Custom account tags ───────────────────────────────────────────────────
  // Free-form label + color per account. Takes precedence over env overrides
  // in the UI. Kept separate from envOverrides so the canonical prod/staging
  // semantics (confirmation dialogs) still apply only to the canonical envs.
  const [customTags, setCustomTags] = useState<Record<string, CustomTag>>(() => {
    try {
      const raw = localStorage.getItem('cloudorbit.customTags')
      return raw ? JSON.parse(raw) : {}
    } catch { return {} }
  })
  useEffect(() => {
    try { localStorage.setItem('cloudorbit.customTags', JSON.stringify(customTags)) } catch { /* quota */ }
  }, [customTags])
  const setCustomTag = useCallback((startUrl: string, accountId: string, tag: CustomTag | null) => {
    const key = envOverrideKey(startUrl, accountId)
    setCustomTags(prev => {
      const next = { ...prev }
      if (tag === null) delete next[key]
      else next[key] = tag
      return next
    })
  }, [])

  // ── News feed ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (URL_MOCK || URL_MOCK_NEWS) return
    loadNews().then(items => {
      setNewsItems(items)
      setNewsUnread(getUnreadIds(items).length)
    })
  }, [])

  // Bell items: synthetic update entry (when dismissed) + one per kind from news
  const bellItems = useMemo(() => {
    type BellItem = { id: string; kind: 'update-available' | 'release' | 'announcement'; title: string; body?: string; date: string; url?: string }
    const items: BellItem[] = []
    if (updateInfo && updaterDismissed) {
      items.push({ id: 'update-available', kind: 'update-available', title: `v${updateInfo.version} is available`, body: 'Click to install the latest update', date: new Date().toISOString() })
    }
    const seen = new Set<string>()
    for (const n of newsItems.filter(i => i.type !== 'ad')) {
      const kind = n.type === 'changelog' ? 'release' : 'announcement'
      if (seen.has(kind)) continue
      seen.add(kind)
      items.push({ id: n.id, kind, title: n.title, body: n.body.split('\n').filter(Boolean)[0] ?? '', date: n.publishedAt, url: n.action?.url })
    }
    return items
  }, [newsItems, updateInfo, updaterDismissed])

  const handleNewsMarkRead = useCallback(() => {
    const ids = newsItems.map(i => i.id)
    markRead(ids)
    setNewsUnread(0)
  }, [newsItems])

  const handleCheckUpdates = useCallback(() => {
    setUpdaterDismissed(false)
    updaterRef.current?.checkForUpdate()
  }, [])

  const handleDismissUpdate = useCallback(() => {
    setUpdateInfo(null)
  }, [])

  // ── Session metadata persistence ──────────────────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem('cloudorbit.sessionMeta', JSON.stringify(sessions.map(toMeta)))
    } catch { /* quota */ }
  }, [sessions])

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
        // Normalise profile names + hydrate aliases from localStorage. The
        // raw shape out of parse_config has no accountName and no alias
        // — `~/.aws/config` doesn't store either. This patches both at the
        // load boundary so everything downstream sees clean data.
        const aliases = readAliases()
        setSsoGroups(config.ssoGroups.map(g => ({
          ...g,
          alias: aliases[g.startUrl] ?? g.alias,
          profiles: g.profiles.map(p => ({
            ...p,
            accountName: p.accountName ?? accountNameFrom(p),
          })),
        })))

        // Restore sessions from ~/.aws/credentials + persisted metadata.
        // Strategy:
        //  1. list_credential_sessions reads all active STS profiles from disk
        //     (those with a cloudorbit-expires-at comment still in the future)
        //  2. We cross-reference with localStorage sessionMeta for rich display
        //     data (accountName, environment, isFavorite, isDefault, etc.)
        //  3. Any session in disk but not in meta gets basic defaults
        // This way sessions survive app restarts even if localStorage was cleared.
        try {
          const diskSessions = await api.listCredentialSessions()

          if (diskSessions.length > 0) {
            // Load localStorage meta for enrichment
            const metaRaw = localStorage.getItem('cloudorbit.sessionMeta')
            const metaList: SessionMeta[] = metaRaw ? JSON.parse(metaRaw) : []
            const metaByProfile = new Map(metaList.map(m => [m.profileName, m]))

            const now = Date.now()
            let counter = sessionIdCounter

            // Build a lookup: accountId → { startUrl, ssoRegion, accountName }
            // from the freshly loaded ssoGroups, so we can fill in missing meta.
            type SsoInfo = { startUrl: string; ssoRegion: string; accountName: string }
            const ssoByAccountId = new Map<string, SsoInfo>()
            for (const g of config.ssoGroups) {
              for (const p of g.profiles) {
                if (p.accountId) {
                  const cleanName = p.accountName ?? p.name.split(' / ')[0] ?? p.name
                  ssoByAccountId.set(p.accountId, {
                    startUrl: g.startUrl,
                    ssoRegion: g.ssoRegion,
                    accountName: cleanName,
                  })
                }
              }
            }

            const restored: Session[] = diskSessions
              .filter(ds => {
                if (!ds.expiresAt) return true
                return new Date(ds.expiresAt).getTime() > now
              })
              .map(ds => {
                const meta = metaByProfile.get(ds.profileName)
                const id = meta?.id ?? String(++counter)
                const expiresAt = ds.expiresAt
                  ?? meta?.expiresAt
                  ?? new Date(now + 8 * 3600 * 1000).toISOString()

                // Parse accountId and roleName from profile name "accountId-roleName"
                const dashIdx = ds.profileName.indexOf('-')
                const parsedAccountId = dashIdx > 0 ? ds.profileName.slice(0, dashIdx) : ds.profileName
                const parsedRoleName  = dashIdx > 0 ? ds.profileName.slice(dashIdx + 1) : ''

                const accountId = meta?.accountId ?? parsedAccountId
                // Recover startUrl and accountName from ssoGroups if meta is missing
                const ssoInfo = ssoByAccountId.get(accountId)

                return {
                  id,
                  accountId,
                  accountName:     meta?.accountName     ?? ssoInfo?.accountName ?? parsedAccountId,
                  roleName:        meta?.roleName        ?? parsedRoleName,
                  startUrl:        meta?.startUrl        || ssoInfo?.startUrl    || '',
                  ssoRegion:       meta?.ssoRegion       ?? ssoInfo?.ssoRegion   ?? ds.region ?? 'us-east-1',
                  region:          ds.region             ?? meta?.region ?? 'us-east-1',
                  accessKeyId:     ds.accessKeyId,
                  secretAccessKey: ds.secretAccessKey,
                  sessionToken:    ds.sessionToken,
                  expiresAt,
                  profileName:     ds.profileName,
                  method:          meta?.method          ?? 'sso' as const,
                  environment:     meta?.environment     ?? 'unknown' as const,
                  isFavorite:      meta?.isFavorite      ?? false,
                  isDefault:       ds.isDefault,
                  clusters:        meta?.clusters        ?? [],
                } satisfies Session
              })

            if (restored.length > 0) {
              if (counter > sessionIdCounter) sessionIdCounter = counter
              setSessions(restored)
            }
          } else {
            // Fallback: try localStorage meta + readProfileCredentials (old behavior)
            const raw = localStorage.getItem('cloudorbit.sessionMeta')
            if (raw) {
              const meta: SessionMeta[] = JSON.parse(raw)
              const now = Date.now()
              const valid = meta.filter(m => new Date(m.expiresAt).getTime() > now)
              if (valid.length > 0) {
                const results = await Promise.all(
                  valid.map(async m => {
                    try {
                      const creds = await api.readProfileCredentials(m.profileName)
                      return { ...m, ...creds, isDefault: m.isDefault ?? false } as Session
                    } catch {
                      return null
                    }
                  })
                )
                const restored = results.filter((s): s is Session => s !== null)
                if (restored.length > 0) {
                  const maxId = Math.max(...restored.map(s => parseInt(s.id) || 0))
                  if (maxId >= sessionIdCounter) sessionIdCounter = maxId
                  setSessions(restored)
                }
              }
            }
          }
        } catch { /* ignore restore errors */ }
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

  // Scrub any session / profile that leaked a non-clean accountName from
  // earlier builds. Handles both " / "-separated (old wizard output) and
  // "-{roleName}" suffixed (parse_config output). Runs on mount only — once
  // hydrated from parse_config the data is clean.
  useEffect(() => {
    setSessions(prev => {
      let changed = false
      const next = prev.map(s => {
        const clean = accountNameFrom({ name: s.accountName, roleName: s.roleName })
        if (clean !== s.accountName) {
          changed = true
          return { ...s, accountName: clean }
        }
        return s
      })
      return changed ? next : prev
    })
    setSsoGroups(prev => {
      let changed = false
      const next = prev.map(g => ({
        ...g,
        profiles: g.profiles.map(p => {
          const clean = accountNameFrom(p)
          if (p.accountName === clean) return p
          changed = true
          return { ...p, accountName: clean }
        }),
      }))
      return changed ? next : prev
    })
  }, [])

  // Add activity event helper
  const addActivity = useCallback((event: Omit<ActivityEvent, 'id' | 'time'>) => {
    setActivity(prev => [{
      ...event,
      id: `ev-${Date.now()}`,
      time: new Date(),
    }, ...prev])
  }, [])

  // ── Expiry notifications ──────────────────────────────────────────────────
  // Fire a native OS notification when a session crosses 30 / 15 / 5 minute
  // thresholds before expiry. Per-session/per-threshold set is held in a ref
  // so a threshold only fires ONCE per session lifetime — otherwise the
  // 1-minute polling loop would keep re-notifying.
  const firedRef = useRef<Map<string, Set<number>>>(new Map())
  useEffect(() => {
    const THRESHOLDS_MIN = [30, 15, 5]
    const tick = () => {
      const now = Date.now()
      for (const s of sessions) {
        const remainMs = new Date(s.expiresAt).getTime() - now
        if (remainMs <= 0) continue
        const remainMin = remainMs / 60000
        const fired = firedRef.current.get(s.id) ?? new Set<number>()
        for (const t of THRESHOLDS_MIN) {
          if (fired.has(t)) continue
          // Fire when we're in a 1-minute window just below the threshold.
          // e.g. threshold=30 → fire when remaining is 29.xx–30.00.
          if (remainMin > t - 1 && remainMin <= t) {
            fired.add(t)
            firedRef.current.set(s.id, fired)
            api.notify(
              `Session expiring in ${t} min`,
              `${s.accountName} / ${s.roleName} — renew to keep access.`,
            ).catch(() => { /* best-effort */ })
            addActivity({
              type: 'session-expire',
              title: `Session expiring in ${t} min`,
              reference: `${s.accountName} / ${s.roleName}`,
            })
          }
        }
      }
      // Clean up entries for sessions that no longer exist, so the map
      // doesn't grow forever as sessions are renewed.
      const ids = new Set(sessions.map(s => s.id))
      for (const id of firedRef.current.keys()) if (!ids.has(id)) firedRef.current.delete(id)
    }
    tick()
    const h = setInterval(tick, 60_000)
    return () => clearInterval(h)
  }, [sessions, addActivity])

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
      profile.region,
    )

    // The session's accountName should be the CLEAN account name ("polaris-
    // development"), not the wizard's display string ("polaris-development /
    // PolarisReadOnly"). Prefer the explicit accountName field when the
    // wizard set it; otherwise strip the " / role" suffix from the legacy
    // `name` field; last resort is the `{accountId}-{roleName}` key.
    const cleanAccountName =
      profile.accountName
      ?? profile.name?.split(' / ')[0]
      ?? `${profile.accountId}-${profile.roleName}`

    const newSession: Session = {
      id: String(++sessionIdCounter),
      accountId: creds.accountId,
      accountName: cleanAccountName,
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
      environment: resolveEnv(envOverrides, profile.startUrl, profile.accountId, profile.name),
      isFavorite: false,
      isDefault: false,
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
  }, [addActivity, envOverrides])

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

  // Stop / clear session — removes credentials from ~/.aws/credentials and
  // drops the session from local state. AWS STS credentials cannot be revoked
  // server-side; this makes them invisible to local tooling.
  const handleStopSession = useCallback(async (session: Session) => {
    try {
      await api.clearSessionCredentials(session.profileName, session.accessKeyId)
    } catch (err) {
      // Best-effort: clear local state even if the credentials file write fails
      console.warn('clearSessionCredentials error (continuing):', err)
    }
    setSessions(prev => prev.filter(s => s.id !== session.id))
    if (selectedSession?.id === session.id) setSelectedSession(null)
    addActivity({
      type: 'session-expire',
      title: 'Session stopped',
      reference: `${session.accountName} / ${session.roleName}`,
      method: session.method,
    })
  }, [addActivity, selectedSession])

  // Pin a session as [default] — writes its credentials to [default] in
  // ~/.aws/credentials so any AWS SDK call without --profile picks it up.
  // Toggling the same session off clears [default] from the file.
  const handleSetDefault = useCallback(async (session: Session) => {
    const willBeDefault = !session.isDefault
    try {
      if (willBeDefault) {
        await api.setDefaultSession(
          session.accessKeyId,
          session.secretAccessKey,
          session.sessionToken,
          session.region,
        )
      } else {
        // Clear [default] from the credentials file
        await api.clearSessionCredentials('default', session.accessKeyId)
      }
    } catch (err) {
      console.warn('setDefaultSession error:', err)
    }
    // Only one session can be default — clear others, toggle this one
    setSessions(prev => prev.map(s => ({
      ...s,
      isDefault: s.id === session.id ? willBeDefault : false,
    })))
  }, [])

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

  // Detect clusters for a session.
  //
  // Throws on failure so the calling UI (Clusters screen + detail panels) can
  // surface the Rust error. Previously this swallowed errors into console.warn
  // and the UI just showed "No clusters found" even when the IAM role lacked
  // eks:ListClusters or the region was wrong.
  //
  // Also patches `selectedSession` in-place when it matches, so the detail
  // panel re-renders with the new cluster list (otherwise the detail panel
  // holds a stale reference from the moment of selection).
  const handleDetectClusters = useCallback(async (session: Session) => {
    const found = await api.listEksClusters(
      session.region,
      session.accessKeyId,
      session.secretAccessKey,
      session.sessionToken,
    )
    setSessions(prev => prev.map(s =>
      s.id === session.id ? { ...s, clusters: found } : s
    ))
    setSelectedSession(prev =>
      prev && prev.id === session.id ? { ...prev, clusters: found } : prev
    )
    if (found.length > 0) {
      addActivity({ type: 'cluster-activate', title: `${found.length} cluster${found.length !== 1 ? 's' : ''} discovered`, reference: session.accountName })
    }
  }, [addActivity])

  // Update alias of an existing SSO connection (used by the inline rename
  // button on Accounts — lets the user set the alias without re-running the
  // whole wizard). Persists to localStorage so the label survives a reload.
  const handleRenameSso = useCallback((startUrl: string, alias: string) => {
    const trimmed = alias.trim()
    setSsoGroups(prev => prev.map(g =>
      g.startUrl === startUrl ? { ...g, alias: trimmed || undefined } : g
    ))
    const aliases = readAliases()
    if (trimmed) aliases[startUrl] = trimmed
    else delete aliases[startUrl]
    writeAliases(aliases)
  }, [])

  // Per-account display aliases — lets users rename individual accounts
  // (e.g. "AWS_Dev_DevNextDeveloper-xxxxx" → "My Dev"). Keyed by
  // `${startUrl}|${accountId}`, persisted in localStorage.
  const [accountAliases, setAccountAliases] = useState<Record<string, string>>(readAccountAliases)
  const handleRenameAccount = useCallback((startUrl: string, accountId: string, alias: string) => {
    const key = `${startUrl}|${accountId}`
    const trimmed = alias.trim()
    setAccountAliases(prev => {
      const next = { ...prev }
      if (trimmed) next[key] = trimmed
      else delete next[key]
      writeAccountAliases(next)
      return next
    })
  }, [])

  // Add a new SSO connection from the wizard
  const handleAddConnection = useCallback((group: SsoGroup) => {
    setSsoGroups(prev => {
      const existing = prev.find(g => g.startUrl === group.startUrl)
      if (existing) {
        return prev.map(g =>
          g.startUrl === group.startUrl
            ? {
                ...g,
                // Adopt the new alias if the user typed one — lets the user
                // rename an existing connection by re-running the wizard.
                alias: group.alias ?? g.alias,
                profiles: [...g.profiles, ...group.profiles.filter(p => !g.profiles.some(ep => ep.name === p.name))],
              }
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
            activity={activity}
            favorites={favorites}
            envOverrides={envOverrides}
            onSelectSession={setSelectedSession}
            onStartSession={handleStartSession}
            onRenewSession={handleRenewSession}
            onStopSession={handleStopSession}
            onSetDefault={handleSetDefault}
            onOpenConsole={handleOpenConsole}
            onDetectClusters={handleDetectClusters}
            onActivateCluster={handleActivateCluster}
            onToggleFavorite={toggleFavorite}
            selectedSession={selectedSession}
            onAddConnection={() => setScreen('accounts')}
            onNavigate={setScreen}
            updateInfo={updateInfo}
            onUpdateClick={() => setUpdaterDismissed(false)}
            onDismissUpdate={() => setUpdateInfo(null)}
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
            onDetectClusters={handleDetectClusters}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
            envOverrides={envOverrides}
            onSetEnvOverride={setEnvOverride}
            customTags={customTags}
            onSetCustomTag={setCustomTag}
            onRenameSso={handleRenameSso}
            accountAliases={accountAliases}
            onRenameAccount={handleRenameAccount}
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
            onStopSession={handleStopSession}
            onSetDefault={handleSetDefault}
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
      case 'news':
        return <News onVisit={() => setNewsUnread(0)} />
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
        newsUnread={newsUnread}
        bellItems={bellItems}
        onNewsMarkRead={handleNewsMarkRead}
        onTriggerUpdate={() => setUpdaterDismissed(false)}
        onDismissUpdate={handleDismissUpdate}
        onCheckUpdates={handleCheckUpdates}
        sessions={sessions}
        selectedSession={selectedSession}
        onCloseDetail={() => setSelectedSession(null)}
        onRenewSession={handleRenewSession}
        onOpenConsole={handleOpenConsole}
        onActivateCluster={handleActivateCluster}
        onDetectClusters={handleDetectClusters}
        activeCluster={activeCluster}
        activity={activity}
      >
        {renderScreen()}
      </Shell>

      {(!URL_MOCK || URL_UPDATER || URL_MOCK_UPDATE) && (
        <UpdaterModal
          ref={updaterRef}
          dismissed={updaterDismissed}
          onDismiss={() => {
            if (updateInfo?.version) {
              try { localStorage.setItem('cloudorbit.updaterDismissed', updateInfo.version) } catch {}
            }
            setUpdaterDismissed(true)
          }}
          onUpdateAvailable={(version, body) => {
            setUpdateInfo({ version, body })
            try {
              if (localStorage.getItem('cloudorbit.updaterDismissed') === version) {
                setUpdaterDismissed(true)
              }
            } catch {}
          }}
        />
      )}

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
