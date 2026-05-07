import React from 'react'
import { motion } from 'framer-motion'
import type { SessionStatus } from '@/types'

interface StatusDotProps {
  status: SessionStatus
  size?: 'sm' | 'md' | 'lg'
}

const colorMap: Record<SessionStatus, string> = {
  active:          '#34d399',
  expiring:        '#fbbf24',
  expired:         '#f87171',
  idle:            '#3d5a7a',
  'requires-auth': '#f87171',
}

const sizeMap = {
  sm: 6,
  md: 8,
  lg: 10,
}

export function StatusDot({ status, size = 'md' }: StatusDotProps) {
  const color = colorMap[status]
  const px = sizeMap[size]

  return (
    <span className="relative inline-flex items-center justify-center flex-shrink-0" style={{ width: px, height: px }}>
      {(status === 'active' || status === 'expiring') && (
        <motion.span
          className="absolute rounded-full opacity-75"
          style={{ backgroundColor: color, width: px, height: px }}
          animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: status === 'expiring' ? 1.2 : 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <span
        className="relative rounded-full flex-shrink-0"
        style={{ backgroundColor: color, width: px, height: px }}
      />
    </span>
  )
}

export default StatusDot
