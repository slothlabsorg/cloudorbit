import type { Config } from 'tailwindcss'
export default {
  content: ['./src/**/*.{ts,tsx}', './index.html'],
  theme: {
    extend: {
      colors: {
        'bg-base':       '#060d1a',
        'bg-elevated':   '#0b1628',
        'bg-surface':    '#0f1f3d',
        'bg-surface2':   '#152a4e',
        'bg-overlay':    '#1a3460',
        border:          '#1e3a5f',
        'border-subtle': '#142038',
        'border-focus':  '#4DA6FF',
        primary:         '#4DA6FF',
        success:         '#34d399',
        warning:         '#fbbf24',
        danger:          '#f87171',
        info:            '#60a5fa',
        'text-primary':  '#f0f6ff',
        'text-secondary':'#7a9cc4',
        'text-muted':    '#3d5a7a',
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        ui:      ['Inter', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        shimmer: 'shimmer 1.5s infinite',
        pulse:   'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
