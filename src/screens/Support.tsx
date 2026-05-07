import React, { useState } from 'react'
import { motion } from 'framer-motion'

export function Support() {
  const [logoCopied, setLogoCopied] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)

  const openLink = (url: string) => {
    window.open(url, '_blank')
  }

  const copyGitHub = () => {
    navigator.clipboard.writeText('https://github.com/slothlabs/cloudorbit')
    setLogoCopied(true)
    setTimeout(() => setLogoCopied(false), 2000)
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Hero section */}
      <div className="flex flex-col items-center px-8 pt-10 pb-6 text-center">
        {/* Floating logo */}
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="mb-5"
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
              src="/images/logo-cloudorbit.PNG"
              alt="CloudOrbit"
              className="w-28 h-auto drop-shadow-2xl rounded-2xl"
              onError={() => setLogoFailed(true)}
            />
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <h1 className="font-display font-bold text-text-primary text-xl mb-3">
            Keep CloudOrbit free forever
          </h1>
          <p className="text-text-secondary text-sm leading-relaxed max-w-md">
            CloudOrbit is built and maintained by a small team that believes great developer tools
            should be <span className="text-primary font-medium">open source and free</span> — not
            locked behind subscriptions or paywalls. Every donation, no matter the size, helps pay
            for infrastructure, keeps the project active, and means the world to us.
          </p>
        </motion.div>
      </div>

      {/* Badges */}
      <motion.div
        className="flex items-center justify-center gap-3 px-8 pb-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <Badge icon={<IconHeart />} label="Free forever" color="text-rose-400" />
        <Badge icon={<IconCode />} label="Open source" color="text-primary" />
        <Badge icon={<IconShield />} label="No tracking" color="text-success" />
      </motion.div>

      {/* Donation buttons */}
      <motion.div
        className="flex flex-col gap-3 px-8 pb-6 max-w-sm mx-auto w-full"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        {/* Ko-fi */}
        <button
          onClick={() => openLink('https://ko-fi.com/slothlabs')}
          className="flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl bg-[#FF5E5B] hover:bg-[#e04f4d] text-white font-semibold text-sm transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
        >
          <KoFiIcon />
          <div className="flex-1 text-left">
            <div className="font-bold">Support on Ko-fi</div>
            <div className="text-xs font-normal opacity-90">Buy us a coffee ☕</div>
          </div>
          <svg className="w-4 h-4 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </button>

        {/* GitHub Sponsors */}
        <button
          onClick={() => openLink('https://github.com/sponsors/slothlabs')}
          className="flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl bg-bg-elevated hover:bg-bg-surface border border-border text-text-primary font-semibold text-sm transition-all shadow hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
        >
          <GitHubSponsorsIcon />
          <div className="flex-1 text-left">
            <div className="font-bold">GitHub Sponsors</div>
            <div className="text-xs font-normal text-text-muted">Monthly or one-time</div>
          </div>
          <svg className="w-4 h-4 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </button>
      </motion.div>

      {/* Divider */}
      <div className="mx-8 mb-5 border-t border-border-subtle" />

      {/* Other ways to help */}
      <motion.div
        className="px-8 pb-8 max-w-sm mx-auto w-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
      >
        <p className="text-text-muted text-[10px] font-semibold uppercase tracking-wider mb-3">Other ways to help</p>
        <div className="space-y-2">
          <HelpRow
            icon={<IconStar />}
            label="Star on GitHub"
            description="Help others discover CloudOrbit"
            action="Star"
            onClick={() => openLink('https://github.com/slothlabs/cloudorbit')}
          />
          <HelpRow
            icon={<IconShare />}
            label="Share with your team"
            description="Tell a colleague who manages cloud accounts"
            action="Copy link"
            onClick={copyGitHub}
            actionDone={logoCopied}
            actionDoneLabel="Copied!"
          />
          <HelpRow
            icon={<IconBug />}
            label="Report a bug"
            description="Help us squash issues faster"
            action="Open issue"
            onClick={() => openLink('https://github.com/slothlabs/cloudorbit/issues/new?template=bug_report.yml')}
          />
        </div>
      </motion.div>

      {/* Footer */}
      <div className="pb-6 text-center">
        <p className="text-text-muted text-[10px]">
          Made with ♥ by{' '}
          <button
            className="text-primary hover:underline"
            onClick={() => openLink('https://slothlabs.org')}
          >
            SlothLabs
          </button>
        </p>
      </div>
    </div>
  )
}

function Badge({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-bg-surface border border-border text-xs font-medium ${color}`}>
      {icon}
      {label}
    </div>
  )
}

function HelpRow({
  icon, label, description, action, onClick, actionDone, actionDoneLabel,
}: {
  icon: React.ReactNode
  label: string
  description: string
  action: string
  onClick: () => void
  actionDone?: boolean
  actionDoneLabel?: string
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-bg-surface border border-border">
      <div className="text-text-muted flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-text-primary text-xs font-medium">{label}</p>
        <p className="text-text-muted text-[10px]">{description}</p>
      </div>
      <button
        onClick={onClick}
        className="flex-shrink-0 text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors px-2.5 py-1 rounded-lg hover:bg-primary/10"
      >
        {actionDone ? actionDoneLabel : action}
      </button>
    </div>
  )
}

// Icons
function IconHeart() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </svg>
  )
}

function IconCode() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="16 18 22 12 16 6"/>
      <polyline points="8 6 2 12 8 18"/>
    </svg>
  )
}

function IconShield() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  )
}

function IconStar() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )
}

function IconShare() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  )
}

function IconBug() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="13" r="4"/>
      <path d="M12 3v4M4.22 10.22l2.83 2.83M19.78 10.22l-2.83 2.83M4 18l2.83-2.83M19.78 18l-2.83-2.83"/>
    </svg>
  )
}

function KoFiIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="10" fill="white" fillOpacity="0.2"/>
      <path d="M12 16h22a4 4 0 010 8H12V16z" fill="white"/>
      <path d="M12 24h10v8H12z" fill="white" fillOpacity="0.7"/>
      <circle cx="34" cy="20" r="3" fill="white" fillOpacity="0.9"/>
    </svg>
  )
}

function GitHubSponsorsIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" className="text-rose-400" fill="currentColor"/>
    </svg>
  )
}

export default Support
