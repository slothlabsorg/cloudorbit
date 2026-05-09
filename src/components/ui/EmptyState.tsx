import React from 'react'
import { motion } from 'framer-motion'
import Button from './Button'

type IllustrationVariant = 'wave' | 'sleep' | 'search' | 'error'

interface EmptyStateProps {
  variant?: IllustrationVariant
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  secondaryAction?: { label: string; onClick: () => void }
}

// Real brand images — swap paths when new assets are ready
const IMAGES: Record<IllustrationVariant, string | null> = {
  wave:   '/images/logo-cloudorbit.PNG', // official CloudOrbit logo sticker
  sleep:  '/images/sloth-mascot.png',    // sloth mascot — sessions / clusters empty
  search: '/images/sloth-mascot.png',    // same mascot for no-results
  error:  '/images/sloth-mascot.png',    // fallback until error asset available
}

// Fallback SVG shown when image is missing/not-yet-created
function FallbackSvg({ variant }: { variant: IllustrationVariant }) {
  const colors: Record<IllustrationVariant, string> = {
    wave:   '#4DA6FF',
    sleep:  '#fbbf24',
    search: '#34d399',
    error:  '#f87171',
  }
  const c = colors[variant]
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" fill="none" className="opacity-50">
      <circle cx="50" cy="50" r="44" fill="#0f1f3d" stroke="#1e3a5f" strokeWidth="2"/>
      {/* Simple sloth placeholder */}
      <ellipse cx="50" cy="58" rx="20" ry="16" fill="#152a4e"/>
      <circle cx="50" cy="38" r="14" fill="#1a3460"/>
      <ellipse cx="44" cy="36" rx="3" ry="3.5" fill="#f0f6ff"/>
      <ellipse cx="56" cy="36" rx="3" ry="3.5" fill="#f0f6ff"/>
      <circle cx="45" cy="36" r="1.5" fill="#060d1a"/>
      <circle cx="57" cy="36" r="1.5" fill="#060d1a"/>
      <path d="M44 44 Q50 48 56 44" stroke={c} strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <circle cx="22" cy="22" r="2" fill={c} opacity="0.5"/>
      <circle cx="78" cy="18" r="1.5" fill={c} opacity="0.4"/>
      <circle cx="74" cy="74" r="1" fill={c} opacity="0.3"/>
    </svg>
  )
}

function SlothImage({ variant }: { variant: IllustrationVariant }) {
  const src = IMAGES[variant]
  const [failed, setFailed] = React.useState(false)

  if (!src || failed) return <FallbackSvg variant={variant} />

  return (
    <img
      src={src}
      alt="CloudOrbit mascot"
      className="w-44 h-auto object-contain drop-shadow-lg"
      style={{ imageRendering: 'auto' }}
      onError={() => setFailed(true)}
    />
  )
}

export function EmptyState({ variant = 'wave', title, description, action, secondaryAction }: EmptyStateProps) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center py-10 px-6 text-center"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="mb-2 pt-2 flex items-center justify-center"
      >
        <SlothImage variant={variant} />
      </motion.div>
      <h3 className="mt-3 text-text-primary font-display font-bold text-base">{title}</h3>
      {description && (
        <p className="mt-1.5 text-text-secondary text-xs max-w-xs leading-relaxed">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-5 flex items-center gap-2">
          {secondaryAction && (
            <Button variant="ghost" size="sm" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
          {action && (
            <Button variant="primary" size="sm" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>
      )}
    </motion.div>
  )
}

export default EmptyState
