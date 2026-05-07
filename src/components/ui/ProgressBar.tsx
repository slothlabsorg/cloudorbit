import React, { useMemo } from 'react'
import { motion } from 'framer-motion'

interface ProgressBarProps {
  expiresAt: string
  createdLookbackMs?: number // how long sessions typically last (default 8h)
  className?: string
}

export function ProgressBar({ expiresAt, createdLookbackMs = 8 * 3600 * 1000, className = '' }: ProgressBarProps) {
  const { percent, color } = useMemo(() => {
    const now = Date.now()
    const exp = new Date(expiresAt).getTime()
    const diffMs = exp - now
    if (diffMs <= 0) return { percent: 0, color: '#f87171' }
    const pct = Math.min(100, (diffMs / createdLookbackMs) * 100)
    let col = '#34d399'
    if (pct < 10) col = '#f87171'
    else if (pct < 25) col = '#fbbf24'
    return { percent: pct, color: col }
  }, [expiresAt, createdLookbackMs])

  return (
    <div className={`w-full bg-border-subtle rounded-full overflow-hidden ${className}`} style={{ height: 3 }}>
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
    </div>
  )
}

export default ProgressBar
