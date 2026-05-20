// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Session } from '@/types'
import { toMeta, filterActiveSessions, loadSessionMeta, type SessionMeta } from './session'

const FUTURE = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
const PAST   = new Date(Date.now() - 60 * 1000).toISOString()

const makeSession = (overrides: Partial<Session> = {}): Session => ({
  id: '101',
  accountId: '123456789012',
  accountName: 'test-account',
  roleName: 'TestRole',
  startUrl: 'https://test.awsapps.com/start',
  ssoRegion: 'us-east-1',
  region: 'us-west-2',
  accessKeyId: 'ASIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  sessionToken: 'AQoXnyc4lcK4w//token==',
  expiresAt: FUTURE,
  profileName: '123456789012-TestRole',
  method: 'sso',
  environment: 'dev',
  isFavorite: false,
  clusters: [],
  ...overrides,
})

describe('toMeta', () => {
  it('strips credentials', () => {
    const meta = toMeta(makeSession())
    expect(meta).not.toHaveProperty('accessKeyId')
    expect(meta).not.toHaveProperty('secretAccessKey')
    expect(meta).not.toHaveProperty('sessionToken')
  })

  it('preserves all metadata fields', () => {
    const s = makeSession()
    const meta = toMeta(s)
    expect(meta.id).toBe(s.id)
    expect(meta.accountId).toBe(s.accountId)
    expect(meta.accountName).toBe(s.accountName)
    expect(meta.roleName).toBe(s.roleName)
    expect(meta.region).toBe(s.region)
    expect(meta.expiresAt).toBe(s.expiresAt)
    expect(meta.method).toBe(s.method)
    expect(meta.environment).toBe(s.environment)
    expect(meta.isFavorite).toBe(s.isFavorite)
    expect(meta.clusters).toEqual([])
  })

  it('round-trip: meta + credentials reconstructs session', () => {
    const original = makeSession()
    const meta = toMeta(original)
    const reconstructed: Session = {
      ...meta,
      accessKeyId: original.accessKeyId,
      secretAccessKey: original.secretAccessKey,
      sessionToken: original.sessionToken,
    }
    expect(reconstructed).toEqual(original)
  })
})

describe('filterActiveSessions', () => {
  it('keeps sessions with future expiresAt', () => {
    const s = makeSession({ expiresAt: FUTURE })
    expect(filterActiveSessions([s])).toHaveLength(1)
  })

  it('removes sessions with past expiresAt', () => {
    const s = makeSession({ expiresAt: PAST })
    expect(filterActiveSessions([s])).toHaveLength(0)
  })

  it('filters mixed list correctly', () => {
    const active  = makeSession({ id: '1', expiresAt: FUTURE })
    const expired = makeSession({ id: '2', expiresAt: PAST })
    const result = filterActiveSessions([active, expired])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })
})

describe('loadSessionMeta', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('returns [] when key is absent', () => {
    expect(loadSessionMeta()).toEqual([])
  })

  it('returns [] for corrupted JSON', () => {
    localStorage.setItem('cloudorbit.sessionMeta', '{{{not json')
    expect(loadSessionMeta()).toEqual([])
  })

  it('returns [] when stored value is not an array', () => {
    localStorage.setItem('cloudorbit.sessionMeta', JSON.stringify({ id: '1' }))
    expect(loadSessionMeta()).toEqual([])
  })

  it('filters expired sessions on load', () => {
    const meta: SessionMeta[] = [
      toMeta(makeSession({ id: '1', expiresAt: FUTURE })),
      toMeta(makeSession({ id: '2', expiresAt: PAST })),
    ]
    localStorage.setItem('cloudorbit.sessionMeta', JSON.stringify(meta))
    const loaded = loadSessionMeta()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].id).toBe('1')
  })

  it('returns valid session metadata intact', () => {
    const s = makeSession()
    const meta = [toMeta(s)]
    localStorage.setItem('cloudorbit.sessionMeta', JSON.stringify(meta))
    const loaded = loadSessionMeta()
    expect(loaded[0].accountName).toBe(s.accountName)
    expect(loaded[0].region).toBe(s.region)
  })
})
