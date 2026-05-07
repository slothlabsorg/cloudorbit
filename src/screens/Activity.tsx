import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ActivityEvent, MethodType } from '@/types'
import { formatTime, formatDate, timeAgo } from '@/lib/time'
import { MethodChip } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'

type ActivityFilter = 'all' | 'sessions' | 'clusters' | 'auth' | 'errors'

interface ActivityProps {
  events: ActivityEvent[]
}

function EventIcon({ type }: { type: ActivityEvent['type'] }) {
  const cls = 'w-4 h-4'
  switch (type) {
    case 'session-start':
      return <svg className={`${cls} text-success`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="5 12 12 5 19 12"/><polyline points="12 5 12 19"/></svg>
    case 'session-renew':
      return <svg className={`${cls} text-info`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
    case 'session-expire':
      return <svg className={`${cls} text-danger`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    case 'cluster-activate':
      return <svg className={`${cls} text-primary`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/></svg>
    case 'kubeconfig-update':
      return <svg className={`${cls} text-info`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
    case 'auth-fail':
      return <svg className={`${cls} text-danger`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
    case 'reauth':
      return <svg className={`${cls} text-warning`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 019.9-1"/></svg>
    default:
      return <svg className={`${cls} text-text-muted`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/></svg>
  }
}

function eventDotColor(type: ActivityEvent['type']): string {
  switch (type) {
    case 'session-start': return 'bg-success'
    case 'session-renew': return 'bg-info'
    case 'session-expire': return 'bg-danger'
    case 'cluster-activate': return 'bg-primary'
    case 'kubeconfig-update': return 'bg-info'
    case 'auth-fail': return 'bg-danger'
    case 'reauth': return 'bg-warning'
    default: return 'bg-text-muted'
  }
}

function matchesFilter(event: ActivityEvent, filter: ActivityFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'sessions') return ['session-start', 'session-renew', 'session-expire'].includes(event.type)
  if (filter === 'clusters') return ['cluster-activate', 'kubeconfig-update'].includes(event.type)
  if (filter === 'auth') return ['reauth', 'auth-fail'].includes(event.type)
  if (filter === 'errors') return ['auth-fail', 'session-expire'].includes(event.type)
  return true
}

function groupByDay(events: ActivityEvent[]): { label: string; events: ActivityEvent[] }[] {
  const groups = new Map<string, ActivityEvent[]>()
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  for (const event of events) {
    const d = event.time
    let label: string
    if (d.toDateString() === today.toDateString()) label = 'Today'
    else if (d.toDateString() === yesterday.toDateString()) label = 'Yesterday'
    else label = formatDate(d)

    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(event)
  }

  return Array.from(groups.entries()).map(([label, events]) => ({ label, events }))
}

const FILTER_LABELS: { id: ActivityFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'clusters', label: 'Clusters' },
  { id: 'auth', label: 'Auth' },
  { id: 'errors', label: 'Errors' },
]

export function Activity({ events }: ActivityProps) {
  const [filter, setFilter] = useState<ActivityFilter>('all')
  const [search, setSearch] = useState('')
  const [selectedEvent, setSelectedEvent] = useState<ActivityEvent | null>(null)

  const filtered = events
    .filter(e => matchesFilter(e, filter))
    .filter(e => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return e.title.toLowerCase().includes(q) || e.reference?.toLowerCase().includes(q)
    })
    .sort((a, b) => b.time.getTime() - a.time.getTime())

  const grouped = groupByDay(filtered)

  const filterCounts: Record<ActivityFilter, number> = {
    all: events.length,
    sessions: events.filter(e => matchesFilter(e, 'sessions')).length,
    clusters: events.filter(e => matchesFilter(e, 'clusters')).length,
    auth: events.filter(e => matchesFilter(e, 'auth')).length,
    errors: events.filter(e => matchesFilter(e, 'errors')).length,
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main timeline */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle flex-shrink-0">
          <div>
            <h1 className="font-display font-bold text-text-primary text-base">Activity</h1>
            <p className="text-text-muted text-xs mt-0.5">
              {events.length} event{events.length !== 1 ? 's' : ''} · Session starts, renewals, cluster activations
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search activity..."
                className="bg-bg-surface border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-text-primary placeholder-text-muted outline-none focus:border-border-focus w-44 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-0 px-5 border-b border-border-subtle flex-shrink-0">
          {FILTER_LABELS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                filter === f.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              {f.label}
              <span className={`px-1 py-0.5 rounded text-[10px] ${
                filter === f.id ? 'bg-primary/20 text-primary' : 'bg-bg-surface text-text-muted'
              }`}>{filterCounts[f.id]}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {filtered.length === 0 ? (
            <EmptyState
              variant="sleep"
              title="No activity here"
              description={filter !== 'all' ? 'No events match this filter.' : 'Session events, cluster activations, and auth flows will appear here.'}
            />
          ) : (
            <div className="space-y-6">
              {grouped.map(({ label, events: dayEvents }) => (
                <div key={label}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-text-muted text-xs font-semibold uppercase tracking-wider">{label}</span>
                    <div className="flex-1 h-px bg-border-subtle" />
                  </div>

                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-px bg-border-subtle" />

                    <div className="space-y-1">
                      {dayEvents.map((event, i) => (
                        <motion.div
                          key={event.id}
                          initial={{ opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2, delay: i * 0.03 }}
                          className={`relative flex items-start gap-4 pl-9 py-2.5 rounded-lg cursor-pointer transition-colors group ${
                            selectedEvent?.id === event.id
                              ? 'bg-primary/8 border border-primary/20'
                              : 'hover:bg-bg-surface'
                          }`}
                          onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
                        >
                          <div className={`absolute left-2.5 top-3.5 w-3 h-3 rounded-full border-2 border-bg-base flex-shrink-0 ${eventDotColor(event.type)}`} />

                          <div className="w-8 h-8 rounded-lg bg-bg-elevated border border-border flex items-center justify-center flex-shrink-0">
                            <EventIcon type={event.type} />
                          </div>

                          <div className="flex-1 min-w-0 pt-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-text-primary text-sm font-medium">{event.title}</span>
                              {event.method && <MethodChip method={event.method as MethodType} />}
                            </div>
                            <p className="text-text-muted text-xs mt-0.5 truncate">{event.reference}</p>
                          </div>

                          <div className="flex-shrink-0 text-right">
                            <p className="text-text-muted text-xs">{formatTime(event.time)}</p>
                            <p className="text-text-muted text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">{timeAgo(event.time)}</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Event detail drawer */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.div
            key="event-detail"
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="w-72 flex-shrink-0 border-l border-border bg-bg-elevated flex flex-col overflow-hidden"
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-bg-surface border border-border flex items-center justify-center">
                  <EventIcon type={selectedEvent.type} />
                </div>
                <h3 className="text-text-primary font-semibold text-sm">{selectedEvent.title}</h3>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-text-muted hover:text-text-primary transition-colors p-1 rounded-lg hover:bg-bg-surface"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {/* Timestamp */}
              <div>
                <p className="text-text-muted text-[10px] font-semibold uppercase tracking-wider mb-2">Timestamp</p>
                <div className="bg-bg-surface rounded-lg px-3 py-2 border border-border-subtle">
                  <p className="text-text-primary text-xs font-mono">{selectedEvent.time.toLocaleString()}</p>
                  <p className="text-text-muted text-[10px] mt-0.5">{timeAgo(selectedEvent.time)}</p>
                </div>
              </div>

              {/* Reference */}
              {selectedEvent.reference && (
                <div>
                  <p className="text-text-muted text-[10px] font-semibold uppercase tracking-wider mb-2">Reference</p>
                  <div className="bg-bg-surface rounded-lg px-3 py-2 border border-border-subtle">
                    <p className="text-text-secondary text-xs">{selectedEvent.reference}</p>
                  </div>
                </div>
              )}

              {/* Method */}
              {selectedEvent.method && (
                <div>
                  <p className="text-text-muted text-[10px] font-semibold uppercase tracking-wider mb-2">Access Method</p>
                  <div className="bg-bg-surface rounded-lg px-3 py-2 border border-border-subtle">
                    <p className="text-text-secondary text-xs capitalize">{selectedEvent.method}</p>
                  </div>
                </div>
              )}

              {/* Event type */}
              <div>
                <p className="text-text-muted text-[10px] font-semibold uppercase tracking-wider mb-2">Event Type</p>
                <div className="bg-bg-surface rounded-lg px-3 py-2 border border-border-subtle">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${eventDotColor(selectedEvent.type)}`} />
                    <p className="text-text-secondary text-xs font-mono">{selectedEvent.type}</p>
                  </div>
                </div>
              </div>

              {/* Technical detail (mock) */}
              <div>
                <p className="text-text-muted text-[10px] font-semibold uppercase tracking-wider mb-2">Technical Detail</p>
                <div className="bg-bg-surface rounded-lg px-3 py-2 border border-border-subtle space-y-1">
                  <p className="text-text-muted text-[10px] font-mono">Event ID: {selectedEvent.id}</p>
                  {selectedEvent.type === 'session-start' && (
                    <p className="text-text-muted text-[10px] font-mono">STS AssumeRoleWithWebIdentity</p>
                  )}
                  {selectedEvent.type === 'session-renew' && (
                    <p className="text-text-muted text-[10px] font-mono">STS GetFederationToken</p>
                  )}
                  {selectedEvent.type === 'cluster-activate' && (
                    <p className="text-text-muted text-[10px] font-mono">EKS UpdateKubeconfig</p>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-3 border-t border-border flex-shrink-0">
              <button
                onClick={() => {
                  const text = `${selectedEvent.title}\n${selectedEvent.reference ?? ''}\n${selectedEvent.time.toISOString()}`
                  navigator.clipboard.writeText(text)
                }}
                className="w-full flex items-center justify-center gap-2 text-xs text-text-secondary hover:text-text-primary bg-bg-surface hover:bg-bg-surface2 border border-border rounded-lg px-3 py-2 transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
                Copy diagnostics
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Activity
