import React from 'react'

type CalloutVariant = 'info' | 'warning' | 'success' | 'danger'

interface CalloutProps {
  variant?: CalloutVariant
  title?: string
  children: React.ReactNode
  className?: string
}

const variantConfig: Record<CalloutVariant, { border: string; bg: string; icon: React.ReactNode; titleColor: string }> = {
  info: {
    border: 'border-l-info',
    bg: 'bg-info/5',
    titleColor: 'text-info',
    icon: (
      <svg className="w-4 h-4 text-info flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
      </svg>
    ),
  },
  warning: {
    border: 'border-l-warning',
    bg: 'bg-warning/5',
    titleColor: 'text-warning',
    icon: (
      <svg className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
      </svg>
    ),
  },
  success: {
    border: 'border-l-success',
    bg: 'bg-success/5',
    titleColor: 'text-success',
    icon: (
      <svg className="w-4 h-4 text-success flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
      </svg>
    ),
  },
  danger: {
    border: 'border-l-danger',
    bg: 'bg-danger/5',
    titleColor: 'text-danger',
    icon: (
      <svg className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
      </svg>
    ),
  },
}

export function Callout({ variant = 'info', title, children, className = '' }: CalloutProps) {
  const cfg = variantConfig[variant]
  return (
    <div className={`border-l-2 ${cfg.border} ${cfg.bg} rounded-r-lg px-4 py-3 ${className}`}>
      <div className="flex gap-2.5">
        {cfg.icon}
        <div className="flex-1 min-w-0">
          {title && <p className={`font-semibold text-sm mb-1 ${cfg.titleColor}`}>{title}</p>}
          <div className="text-text-secondary text-xs leading-relaxed">{children}</div>
        </div>
      </div>
    </div>
  )
}

export default Callout
