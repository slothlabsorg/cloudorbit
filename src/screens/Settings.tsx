import React, { useState } from 'react'
import { Toggle } from '@/components/ui/Toggle'
import { Callout } from '@/components/ui/Callout'
import Button from '@/components/ui/Button'

type SettingsSection = 'appearance' | 'aws' | 'kubernetes' | 'security'

interface SettingsProps {}

const navItems: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
  {
    id: 'appearance',
    label: 'Appearance',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
      </svg>
    ),
  },
  {
    id: 'aws',
    label: 'AWS Defaults',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="14" rx="2"/>
        <path d="M3 20h18"/>
      </svg>
    ),
  },
  {
    id: 'kubernetes',
    label: 'Kubernetes Safety',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
  },
  {
    id: 'security',
    label: 'Security',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0110 0v4"/>
      </svg>
    ),
  },
]

// ── Section components ────────────────────────────────────────────────────────

function AppearanceSection() {
  const [compactMode, setCompactMode] = useState(false)
  const [animationsEnabled, setAnimationsEnabled] = useState(true)
  const [showAccountIds, setShowAccountIds] = useState(false)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-text-primary font-display font-bold text-sm mb-3">Interface</h2>
        <div className="space-y-3">
          <SettingRow
            label="Compact Mode"
            description="Reduce row heights and spacing"
          >
            <Toggle checked={compactMode} onChange={setCompactMode} />
          </SettingRow>
          <SettingRow
            label="Animations"
            description="Enable motion and transitions"
          >
            <Toggle checked={animationsEnabled} onChange={setAnimationsEnabled} />
          </SettingRow>
          <SettingRow
            label="Show Full Account IDs"
            description="Display account IDs unmasked in the table"
          >
            <Toggle checked={showAccountIds} onChange={setShowAccountIds} />
          </SettingRow>
        </div>
      </div>

      <div>
        <h2 className="text-text-primary font-display font-bold text-sm mb-3">Window</h2>
        <div className="space-y-3">
          <SettingRow
            label="Start at Login"
            description="Launch CloudOrbit when you log in"
          >
            <Toggle checked={false} onChange={() => {}} />
          </SettingRow>
          <SettingRow
            label="Start Minimized"
            description="Open to menu bar on launch"
          >
            <Toggle checked={false} onChange={() => {}} disabled />
          </SettingRow>
        </div>
      </div>
    </div>
  )
}

function AwsSection() {
  const [defaultRegion, setDefaultRegion] = useState('us-east-1')
  const [autoWriteCredentials, setAutoWriteCredentials] = useState(true)
  const [sessionDuration, setSessionDuration] = useState('8')

  const regions = [
    'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
    'eu-west-1', 'eu-west-2', 'eu-central-1',
    'ap-northeast-1', 'ap-southeast-1', 'ap-southeast-2',
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-text-primary font-display font-bold text-sm mb-3">Credentials</h2>
        <div className="space-y-3">
          <SettingRow
            label="Auto-write to ~/.aws/credentials"
            description="Write temporary credentials after each assume-role"
          >
            <Toggle checked={autoWriteCredentials} onChange={setAutoWriteCredentials} />
          </SettingRow>
          <SettingRow
            label="Session Duration (hours)"
            description="Maximum session duration for assumed roles"
          >
            <select
              value={sessionDuration}
              onChange={e => setSessionDuration(e.target.value)}
              className="bg-bg-surface border border-border rounded-lg px-3 py-1.5 text-text-primary text-xs outline-none focus:border-border-focus"
            >
              {['1', '2', '4', '8', '12'].map(v => (
                <option key={v} value={v}>{v}h</option>
              ))}
            </select>
          </SettingRow>
        </div>
      </div>

      <div>
        <h2 className="text-text-primary font-display font-bold text-sm mb-3">Defaults</h2>
        <div className="space-y-3">
          <SettingRow
            label="Default Region"
            description="Fallback region for new sessions"
          >
            <select
              value={defaultRegion}
              onChange={e => setDefaultRegion(e.target.value)}
              className="bg-bg-surface border border-border rounded-lg px-3 py-1.5 text-text-primary text-xs outline-none focus:border-border-focus"
            >
              {regions.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </SettingRow>
        </div>
      </div>
    </div>
  )
}

function KubernetesSection() {
  const [prodConfirmation, setProdConfirmation] = useState(true)
  const [autoDetectClusters, setAutoDetectClusters] = useState(false)
  const [backupKubeconfig, setBackupKubeconfig] = useState(true)

  return (
    <div className="space-y-6">
      <Callout variant="warning" title="Production Safety">
        These settings control behavior when activating kubeconfigs for production clusters.
        Disabling safety features can result in accidental production changes.
      </Callout>

      <div>
        <h2 className="text-text-primary font-display font-bold text-sm mb-3">Safety</h2>
        <div className="space-y-3">
          <SettingRow
            label="Require Confirmation for PROD"
            description="Show a warning dialog before activating production cluster contexts"
          >
            <Toggle checked={prodConfirmation} onChange={setProdConfirmation} />
          </SettingRow>
          <SettingRow
            label="Backup kubeconfig before changes"
            description="Save a timestamped backup of ~/.kube/config before each update"
          >
            <Toggle checked={backupKubeconfig} onChange={setBackupKubeconfig} />
          </SettingRow>
        </div>
      </div>

      <div>
        <h2 className="text-text-primary font-display font-bold text-sm mb-3">Discovery</h2>
        <div className="space-y-3">
          <SettingRow
            label="Auto-detect clusters on session start"
            description="Run list_eks_clusters after each successful assume-role"
          >
            <Toggle checked={autoDetectClusters} onChange={setAutoDetectClusters} />
          </SettingRow>
        </div>
      </div>
    </div>
  )
}

function SecuritySection() {
  const [useKeychain, setUseKeychain] = useState(true)
  const [clearOnLock, setClearOnLock] = useState(false)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-text-primary font-display font-bold text-sm mb-3">Token Storage</h2>
        <div className="space-y-3">
          <SettingRow
            label="Use System Keychain"
            description="Store SSO tokens in macOS Keychain (recommended)"
          >
            <Toggle checked={useKeychain} onChange={setUseKeychain} />
          </SettingRow>
          <SettingRow
            label="Clear credentials on screen lock"
            description="Revoke in-memory credentials when the screen is locked"
          >
            <Toggle checked={clearOnLock} onChange={setClearOnLock} />
          </SettingRow>
        </div>
      </div>

      <div>
        <h2 className="text-text-primary font-display font-bold text-sm mb-3">Token Cache</h2>
        <div className="bg-bg-elevated border border-border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-primary text-sm">SSO Token Cache</p>
              <p className="text-text-muted text-xs mt-0.5">~/.aws/sso/cache/ and system keychain</p>
            </div>
            <Button variant="danger" size="sm">
              Clear Cache
            </Button>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-text-primary font-display font-bold text-sm mb-3">About</h2>
        <div className="bg-bg-elevated border border-border rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-text-muted">Version</span>
            <span className="text-text-secondary font-mono">0.1.0</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-text-muted">Tauri</span>
            <span className="text-text-secondary font-mono">2.x</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-text-muted">React</span>
            <span className="text-text-secondary font-mono">18.3.x</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function SettingRow({ label, description, children, disabled }: {
  label: string
  description?: string
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <div className={`flex items-center justify-between gap-4 bg-bg-elevated border border-border rounded-xl px-4 py-3 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex-1 min-w-0">
        <p className="text-text-primary text-sm">{label}</p>
        {description && <p className="text-text-muted text-xs mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

const sectionComponents: Record<SettingsSection, React.ReactNode> = {
  appearance: <AppearanceSection />,
  aws: <AwsSection />,
  kubernetes: <KubernetesSection />,
  security: <SecuritySection />,
}

export function Settings(_props: SettingsProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('appearance')

  return (
    <div className="flex h-full overflow-hidden">
      {/* Settings nav */}
      <div className="w-48 flex-shrink-0 border-r border-border bg-bg-elevated overflow-y-auto">
        <div className="p-3">
          <p className="text-text-muted text-[10px] font-semibold uppercase tracking-wider px-2 mb-2">Preferences</p>
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors mb-0.5 ${
                activeSection === item.id
                  ? 'bg-primary/10 text-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Settings content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <h1 className="font-display font-bold text-text-primary text-base mb-5">
          {navItems.find(n => n.id === activeSection)?.label}
        </h1>
        {sectionComponents[activeSection]}
      </div>
    </div>
  )
}

export default Settings
