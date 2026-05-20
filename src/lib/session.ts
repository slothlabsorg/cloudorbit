import type { Session } from '@/types'

export type SessionMeta = Omit<Session, 'accessKeyId' | 'secretAccessKey' | 'sessionToken'>

export function toMeta(s: Session): SessionMeta {
  const { accessKeyId: _a, secretAccessKey: _b, sessionToken: _c, ...meta } = s
  return meta
}

export function filterActiveSessions(sessions: Session[]): Session[] {
  return sessions.filter(s => new Date(s.expiresAt).getTime() > Date.now())
}

export function loadSessionMeta(): SessionMeta[] {
  try {
    const raw = localStorage.getItem('cloudorbit.sessionMeta')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const now = Date.now()
    return parsed.filter((m: unknown) =>
      m && typeof m === 'object' &&
      typeof (m as SessionMeta).expiresAt === 'string' &&
      new Date((m as SessionMeta).expiresAt).getTime() > now
    ) as SessionMeta[]
  } catch {
    return []
  }
}
