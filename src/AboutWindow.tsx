import React, { useState } from 'react'
import { motion } from 'framer-motion'
import pkg from '../package.json'
import { api } from './lib/tauri'

// Dedicated About window — opened from the CloudOrbit → About menu and from
// the tray menu on platforms that have one. Rendered when main.tsx sees
// `?window=about`. Kept intentionally small so the window can stay ~360×440
// and feel like a native "About" panel.

const WEBSITE = 'https://slothlabs.org/cloudorbit'
const GITHUB  = 'https://github.com/slothlabsorg/cloudorbit'
const KOFI    = 'https://ko-fi.com/slothlabs'

export function AboutWindow() {
  const [logoFailed, setLogoFailed] = useState(false)

  const open = (url: string) => {
    api.openExternalUrl(url).catch(() => {
      window.open(url, '_blank')
    })
  }

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-bg-base text-text-primary px-8 select-none">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex flex-col items-center text-center"
      >
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="mb-4"
        >
          {logoFailed ? (
            <div className="w-24 h-24 rounded-3xl bg-bg-surface border border-border flex items-center justify-center shadow-xl">
              <svg className="w-12 h-12 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>
                <ellipse cx="12" cy="12" rx="10" ry="4.5" strokeDasharray="3 2"/>
              </svg>
            </div>
          ) : (
            <img
              src="/images/sloth-mascot.png"
              alt="CloudOrbit mascot"
              className="w-28 h-auto drop-shadow-2xl"
              onError={() => setLogoFailed(true)}
            />
          )}
        </motion.div>

        <h1 className="font-display font-bold text-xl mb-1">CloudOrbit</h1>
        <p className="text-text-muted text-xs font-mono mb-3">Version {pkg.version}</p>
        <p className="text-text-secondary text-sm leading-relaxed max-w-xs mb-5">
          Your cloud access control center — SSO, sessions, clusters, and the
          AWS console, all in one place.
        </p>

        <div className="flex flex-col w-full max-w-[220px] gap-2 mb-5">
          <button
            onClick={() => open(WEBSITE)}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors text-xs font-medium"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            slothlabs.org/cloudorbit
          </button>
          <button
            onClick={() => open(GITHUB)}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-surface border border-border text-text-secondary hover:border-primary/40 hover:text-text-primary transition-colors text-xs"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.2 11.39.6.11.82-.26.82-.57v-2c-3.34.73-4.04-1.6-4.04-1.6-.54-1.39-1.33-1.76-1.33-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.66-.3-5.46-1.33-5.46-5.93 0-1.31.47-2.39 1.24-3.23-.12-.3-.54-1.53.12-3.2 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.3-1.55 3.3-1.23 3.3-1.23.66 1.67.24 2.9.12 3.2.77.84 1.24 1.92 1.24 3.23 0 4.61-2.8 5.63-5.47 5.93.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58C20.56 22.29 24 17.8 24 12.5 24 5.87 18.63.5 12 .5z"/>
            </svg>
            View on GitHub
          </button>
          <button
            onClick={() => open(KOFI)}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-surface border border-border text-text-secondary hover:border-primary/40 hover:text-text-primary transition-colors text-xs"
          >
            ☕ Support on Ko-fi
          </button>
        </div>

        <p className="text-text-muted text-[10px]">
          Made with ♥ by <span className="text-text-secondary">SlothLabs</span>
        </p>
        <p className="text-text-muted text-[10px] mt-0.5">
          © 2026 SlothLabs · MIT License
        </p>
      </motion.div>
    </div>
  )
}

export default AboutWindow
