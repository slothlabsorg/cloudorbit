import React from 'react'
import { motion } from 'framer-motion'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'icon'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  children: React.ReactNode
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-primary text-bg-base font-semibold hover:bg-blue-400 active:bg-blue-600 shadow-lg shadow-primary/20',
  secondary: 'bg-bg-surface border border-border text-text-primary hover:bg-bg-surface2 hover:border-border-focus',
  danger: 'bg-danger/10 border border-danger/40 text-danger hover:bg-danger/20 hover:border-danger',
  ghost: 'text-text-secondary hover:text-text-primary hover:bg-bg-surface',
  icon: 'text-text-secondary hover:text-text-primary hover:bg-bg-surface rounded-lg p-2',
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-md gap-1.5',
  md: 'px-4 py-2 text-sm rounded-lg gap-2',
  lg: 'px-5 py-2.5 text-sm rounded-lg gap-2',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const isIcon = variant === 'icon'
  return (
    <motion.button
      whileTap={{ scale: disabled || loading ? 1 : 0.96 }}
      transition={{ duration: 0.1 }}
      className={[
        'inline-flex items-center justify-center font-ui transition-colors duration-150 cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
        isIcon ? variantClasses.icon : variantClasses[variant],
        isIcon ? '' : sizeClasses[size],
        (disabled || loading) ? 'opacity-50 cursor-not-allowed' : '',
        className,
      ].join(' ')}
      disabled={disabled || loading}
      {...(props as React.ComponentPropsWithoutRef<typeof motion.button>)}
    >
      {loading && (
        <svg className="animate-spin w-3.5 h-3.5 mr-1.5 flex-shrink-0" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </motion.button>
  )
}

export default Button
