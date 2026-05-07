/**
 * Unit tests for src/lib/time.ts
 *
 * All time-dependent tests use fixed offsets from Date.now() so they're
 * deterministic regardless of when they run.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatExpiry, detectEnv, timeAgo, formatDate, formatTime } from './time'

// ── formatExpiry ──────────────────────────────────────────────────────────────

describe('formatExpiry', () => {
  it('returns Unknown/active for null', () => {
    expect(formatExpiry(null)).toEqual({ label: 'Unknown', status: 'active' })
  })

  it('returns Unknown/active for undefined', () => {
    expect(formatExpiry(undefined)).toEqual({ label: 'Unknown', status: 'active' })
  })

  it('returns Expired/expired for a past timestamp', () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    expect(formatExpiry(past)).toEqual({ label: 'Expired', status: 'expired' })
  })

  it('returns expiring status when < 30 minutes remain', () => {
    const soon = new Date(Date.now() + 20 * 60_000).toISOString()
    const { status } = formatExpiry(soon)
    expect(status).toBe('expiring')
  })

  it('returns active status when >= 30 minutes remain', () => {
    const later = new Date(Date.now() + 90 * 60_000).toISOString()
    const { status } = formatExpiry(later)
    expect(status).toBe('active')
  })

  it('formats minutes-only label when < 1 hour remains', () => {
    const soon = new Date(Date.now() + 25 * 60_000).toISOString()
    const { label } = formatExpiry(soon)
    expect(label).toMatch(/^\d+m$/)
  })

  it('formats hours+minutes label when >= 1 hour remains', () => {
    const later = new Date(Date.now() + 90 * 60_000).toISOString()
    const { label } = formatExpiry(later)
    expect(label).toMatch(/^\d+h \d+m$/)
  })

  it('rounds down to whole minutes', () => {
    // 45 minutes + 45 seconds → should report 45m
    const t = new Date(Date.now() + 45 * 60_000 + 45_000).toISOString()
    const { label } = formatExpiry(t)
    expect(label).toBe('45m')
  })
})

// ── detectEnv ─────────────────────────────────────────────────────────────────

describe('detectEnv', () => {
  it.each([
    ['prod-account', 'prod'],
    ['MyProduction', 'prod'],
    ['live-payments', 'prod'],
    ['staging-api', 'staging'],
    ['STAG', 'staging'],
    ['dev', 'dev'],
    ['development-us-east', 'dev'],
    ['develop-cluster', 'dev'],
    ['sandbox-01', 'sandbox'],
    ['test-account', 'sandbox'],
    ['sand-env', 'sandbox'],
    ['random-account', 'unknown'],
    ['', 'unknown'],
  ])('"%s" → %s', (input, expected) => {
    expect(detectEnv(input)).toBe(expected)
  })

  it('is case-insensitive', () => {
    expect(detectEnv('PRODUCTION')).toBe('prod')
    expect(detectEnv('STAGING')).toBe('staging')
    expect(detectEnv('DEV')).toBe('dev')
    expect(detectEnv('SANDBOX')).toBe('sandbox')
  })
})

// ── timeAgo ───────────────────────────────────────────────────────────────────

describe('timeAgo', () => {
  it('returns "just now" for < 1 minute ago', () => {
    const d = new Date(Date.now() - 30_000)
    expect(timeAgo(d)).toBe('just now')
  })

  it('returns "Xm ago" for minutes ago', () => {
    const d = new Date(Date.now() - 5 * 60_000)
    expect(timeAgo(d)).toBe('5m ago')
  })

  it('returns "Xh ago" for hours ago', () => {
    const d = new Date(Date.now() - 3 * 60 * 60_000)
    expect(timeAgo(d)).toBe('3h ago')
  })

  it('returns "Xd ago" for days ago', () => {
    const d = new Date(Date.now() - 2 * 24 * 60 * 60_000)
    expect(timeAgo(d)).toBe('2d ago')
  })

  it('returns "59m ago" at the 59-minute boundary', () => {
    const d = new Date(Date.now() - 59 * 60_000)
    expect(timeAgo(d)).toBe('59m ago')
  })

  it('returns "1h ago" at exactly 60 minutes', () => {
    const d = new Date(Date.now() - 60 * 60_000)
    expect(timeAgo(d)).toBe('1h ago')
  })

  it('returns "1d ago" at exactly 24 hours', () => {
    const d = new Date(Date.now() - 24 * 60 * 60_000)
    expect(timeAgo(d)).toBe('1d ago')
  })
})
