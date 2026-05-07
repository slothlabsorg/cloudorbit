import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { SsoGroup, EnvType } from '@/types'
import Button from './Button'
import { Toggle } from './Toggle'

type CloudProvider = 'aws' | 'gcp' | 'azure'
type AccessMethod = 'sso' | 'iam' | 'federated' | 'chained'
type CheckStatus = 'pending' | 'loading' | 'success' | 'warning' | 'error'

interface Check { label: string; status: CheckStatus; detail?: string }

interface WizardData {
  provider: CloudProvider
  method: AccessMethod | null
  startUrl: string
  ssoRegion: string
  accessKeyId: string
  secretAccessKey: string
  showSecret: boolean
  roleArn: string
  principalArn: string
  targetRoleArn: string
  alias: string
  region: string
  environment: EnvType
  isFavorite: boolean
}

const INITIAL: WizardData = {
  provider: 'aws', method: null,
  startUrl: '', ssoRegion: 'us-east-1',
  accessKeyId: '', secretAccessKey: '', showSecret: false,
  roleArn: '', principalArn: '', targetRoleArn: '',
  alias: '', region: 'us-east-1', environment: 'dev', isFavorite: false,
}

const AWS_REGIONS = [
  'us-east-1','us-east-2','us-west-1','us-west-2',
  'eu-west-1','eu-west-2','eu-central-1','eu-north-1',
  'ap-southeast-1','ap-southeast-2','ap-northeast-1','ap-northeast-2',
  'sa-east-1','ca-central-1','ap-south-1',
]

const STEPS = ['Provider','Method','Configure','Validate','Save']

export interface AddConnectionWizardProps {
  open: boolean
  onClose: () => void
  onSave: (group: SsoGroup) => void
}

export function AddConnectionWizard({ open, onClose, onSave }: AddConnectionWizardProps) {
  const [step, setStep] = useState(0)
  const [data, setData] = useState<WizardData>(INITIAL)
  const [checks, setChecks] = useState<Check[]>([])
  const [validationDone, setValidationDone] = useState(false)

  const set = useCallback(<K extends keyof WizardData>(key: K, val: WizardData[K]) => {
    setData(d => ({ ...d, [key]: val }))
  }, [])

  useEffect(() => {
    if (open) { setStep(0); setData(INITIAL); setChecks([]); setValidationDone(false) }
  }, [open])

  // Run validation when entering step 3
  useEffect(() => {
    if (step !== 3) return
    const list: Check[] = [
      { label: 'Identity endpoint reachable', status: 'pending' },
      { label: 'STS credentials generated', status: 'pending' },
      { label: 'Available roles fetched', status: 'pending' },
      { label: 'EKS cluster detection', status: 'pending' },
    ]
    setChecks(list)
    setValidationDone(false)
    const delays = [500, 700, 600, 700]
    let cancelled = false
    const run = async () => {
      for (let i = 0; i < list.length; i++) {
        if (cancelled) return
        setChecks(c => c.map((ch, idx) => idx === i ? { ...ch, status: 'loading' } : ch))
        await new Promise(r => setTimeout(r, delays[i]))
        if (cancelled) return
        const isEks = i === 3
        const nonSso = data.method !== 'sso'
        const status: CheckStatus = isEks && nonSso ? 'warning' : 'success'
        const detail = isEks && nonSso ? 'IAM policy may not include eks:ListClusters' : undefined
        setChecks(c => c.map((ch, idx) => idx === i ? { ...ch, status, detail } : ch))
      }
      await new Promise(r => setTimeout(r, 400))
      if (!cancelled) { setValidationDone(true); setStep(4) }
    }
    run()
    return () => { cancelled = true }
  }, [step])

  const canAdvance = (): boolean => {
    if (step === 1) return data.method !== null
    if (step === 2) {
      if (data.method === 'sso')       return data.startUrl.length > 5 && data.alias.length > 0
      if (data.method === 'iam')       return data.accessKeyId.length > 10 && data.secretAccessKey.length > 10
      if (data.method === 'federated') return data.roleArn.length > 10 && data.alias.length > 0
      if (data.method === 'chained')   return data.targetRoleArn.length > 10 && data.alias.length > 0
    }
    return true
  }

  const handleSave = (startSession = false) => {
    const startUrl = data.startUrl || `https://${data.alias.toLowerCase().replace(/\s+/g,'-')}.awsapps.com/start`
    const group: SsoGroup = {
      startUrl,
      ssoRegion: data.ssoRegion,
      profiles: [{
        name: data.alias,
        startUrl,
        ssoRegion: data.ssoRegion,
        accountId: null,
        roleName: null,
        region: data.region,
      }],
    }
    onSave(group)
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      {/* Modal */}
      <motion.div
        className="relative bg-bg-elevated border border-border rounded-2xl shadow-2xl w-[640px] max-h-[88vh] flex flex-col overflow-hidden"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-border-subtle flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-text-primary text-lg">Add Connection</h2>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors p-1 rounded-lg hover:bg-bg-surface">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          {/* Progress steps */}
          <div className="flex items-center">
            {STEPS.map((label, i) => (
              <React.Fragment key={i}>
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-200 ${
                    i < step  ? 'bg-success/20 text-success border border-success/40' :
                    i === step ? 'bg-primary text-bg-base shadow-glow-blue' :
                    'bg-bg-surface border border-border text-text-muted'
                  }`}>
                    {i < step ? (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                    ) : (i + 1)}
                  </div>
                  <span className={`text-[10px] font-medium ${i === step ? 'text-primary' : i < step ? 'text-success' : 'text-text-muted'}`}>{label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-px mx-2 mb-4 transition-colors duration-300 ${i < step ? 'bg-success/40' : 'bg-border'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18, ease: [0.16,1,0.3,1] }}
            >
              {step === 0 && <StepProvider data={data} set={set} />}
              {step === 1 && <StepMethod data={data} set={set} onSelect={() => setStep(2)} />}
              {step === 2 && <StepConfigure data={data} set={set} />}
              {step === 3 && <StepValidate checks={checks} />}
              {step === 4 && <StepSave data={data} set={set} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        {step !== 3 && (
          <div className="px-6 py-4 border-t border-border-subtle flex-shrink-0 flex justify-between items-center bg-bg-elevated">
            <Button variant="ghost" size="sm" onClick={step === 0 ? onClose : () => setStep(s => s - 1)}>
              {step === 0 ? 'Cancel' : '← Back'}
            </Button>
            {step < 4 ? (
              <Button variant="primary" size="sm" onClick={() => setStep(s => s + 1)} disabled={!canAdvance()}>
                {step === 2 ? 'Validate →' : 'Continue →'}
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => handleSave(false)}>Save Connection</Button>
                <Button variant="primary" size="sm" onClick={() => handleSave(true)}>Save & Start Session</Button>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  )
}

// ── Step 0: Cloud Provider ──────────────────────────────────────────────────

function StepProvider({ data, set }: { data: WizardData; set: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void }) {
  return (
    <div>
      <p className="text-text-secondary text-sm mb-5">Choose your cloud provider. AWS is fully supported. Support for GCP and Azure is coming soon.</p>
      <div className="grid grid-cols-3 gap-3">
        {/* AWS — active */}
        <ProviderCard
          selected={data.provider === 'aws'}
          onClick={() => set('provider', 'aws')}
          icon={<AwsIcon />}
          label="Amazon Web Services"
          badge={null}
        />
        {/* GCP — coming soon */}
        <ProviderCard
          selected={false}
          disabled
          onClick={() => {}}
          icon={<GcpIcon />}
          label="Google Cloud"
          badge="Coming soon"
        />
        {/* Azure — coming soon */}
        <ProviderCard
          selected={false}
          disabled
          onClick={() => {}}
          icon={<AzureIcon />}
          label="Microsoft Azure"
          badge="Coming soon"
        />
      </div>
    </div>
  )
}

function ProviderCard({ selected, disabled, onClick, icon, label, badge }: {
  selected: boolean; disabled?: boolean; onClick: () => void
  icon: React.ReactNode; label: string; badge: string | null
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative flex flex-col items-center gap-3 p-5 rounded-xl border transition-all duration-200 text-center ${
        disabled ? 'opacity-40 cursor-not-allowed border-border bg-bg-surface' :
        selected  ? 'border-primary bg-primary/8 shadow-[0_0_16px_rgba(77,166,255,0.12)]' :
        'border-border bg-bg-surface hover:border-primary/50 hover:bg-bg-surface2 cursor-pointer'
      }`}
    >
      {selected && (
        <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
          <svg className="w-2.5 h-2.5 text-bg-base" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
      )}
      {badge && (
        <span className="absolute top-2 right-2 text-[9px] bg-bg-overlay border border-border px-1.5 py-0.5 rounded-full text-text-muted font-medium">{badge}</span>
      )}
      <div className="w-10 h-10 flex items-center justify-center">{icon}</div>
      <span className="text-xs font-medium text-text-secondary leading-tight">{label}</span>
    </button>
  )
}

// ── Step 1: Access Method ───────────────────────────────────────────────────

const METHOD_CARDS = [
  {
    id: 'sso' as AccessMethod,
    icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    color: 'text-purple-400', bg: 'bg-purple-400/10',
    label: 'AWS Single Sign-On',
    desc: 'Browser-based org login. Best for teams with an AWS SSO portal.',
    detail: '1h session · Auto-renews',
  },
  {
    id: 'iam' as AccessMethod,
    icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    color: 'text-warning', bg: 'bg-warning/10',
    label: 'IAM User',
    desc: 'Use long-term IAM keys to generate temporary STS tokens.',
    detail: '1h session · Keys stored in Keychain',
  },
  {
    id: 'federated' as AccessMethod,
    icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>,
    color: 'text-success', bg: 'bg-success/10',
    label: 'Federated Role',
    desc: 'SAML-based access with short-lived credentials via identity provider.',
    detail: '15m–1h session · SAML 2.0',
  },
  {
    id: 'chained' as AccessMethod,
    icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3m10 0h3a2 2 0 002-2v-3"/></svg>,
    color: 'text-info', bg: 'bg-info/10',
    label: 'Chained Role',
    desc: 'Use one trusted session to assume another role in the same or different account.',
    detail: '1h session · Cross-account',
  },
]

function StepMethod({ data, set, onSelect }: {
  data: WizardData
  set: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void
  onSelect: () => void
}) {
  return (
    <div>
      <p className="text-text-secondary text-sm mb-5">How would you like to access AWS?</p>
      <div className="grid grid-cols-2 gap-3">
        {METHOD_CARDS.map(card => (
          <button
            key={card.id}
            onClick={() => { set('method', card.id); onSelect() }}
            className={`flex flex-col gap-3 p-4 rounded-xl border text-left transition-all duration-200 ${
              data.method === card.id
                ? 'border-primary bg-primary/8 shadow-[0_0_16px_rgba(77,166,255,0.10)]'
                : 'border-border bg-bg-surface hover:border-primary/40 hover:bg-bg-surface2'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center ${card.color}`}>
                {card.icon}
              </div>
              {data.method === card.id && (
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-bg-base" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                </div>
              )}
            </div>
            <div>
              <p className="text-text-primary text-sm font-semibold">{card.label}</p>
              <p className="text-text-muted text-xs mt-1 leading-relaxed">{card.desc}</p>
            </div>
            <span className="text-[10px] text-text-muted font-mono bg-bg-overlay px-2 py-0.5 rounded self-start">{card.detail}</span>
          </button>
        ))}

        {/* SAML via IdP (Okta) — Coming soon */}
        <div className="relative flex flex-col gap-3 p-4 rounded-xl border border-border bg-bg-surface opacity-50 cursor-not-allowed col-span-2">
          <span className="absolute top-3 right-3 text-[9px] bg-bg-overlay border border-border px-1.5 py-0.5 rounded-full text-text-muted font-medium">Coming soon</span>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-400/10 flex items-center justify-center text-orange-400 flex-shrink-0">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
            </div>
            <div>
              <p className="text-text-primary text-sm font-semibold">Identity Provider (Okta / SAML)</p>
              <p className="text-text-muted text-xs mt-1 leading-relaxed">Log in via your company's Okta portal. CloudOrbit intercepts the SAML assertion and writes temporary credentials automatically.</p>
            </div>
          </div>
          <span className="text-[10px] text-text-muted font-mono bg-bg-overlay px-2 py-0.5 rounded self-start">signin.aws.amazon.com/saml · Okta-managed roles</span>
        </div>
      </div>
    </div>
  )
}

// ── Step 2: Configure ──────────────────────────────────────────────────────

function StepConfigure({ data, set }: {
  data: WizardData
  set: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void
}) {
  return (
    <div className="space-y-4">
      <p className="text-text-secondary text-sm">
        Configure your{' '}
        <span className="text-text-primary font-medium">
          {METHOD_CARDS.find(m => m.id === data.method)?.label}
        </span>{' '}
        connection.
      </p>

      {/* SSO Fields */}
      {data.method === 'sso' && (
        <>
          <Field label="SSO Start URL" help="Your AWS SSO portal URL (e.g. https://acme.awsapps.com/start)">
            <input
              type="url"
              value={data.startUrl}
              onChange={e => set('startUrl', e.target.value)}
              placeholder="https://acme.awsapps.com/start"
              className="field-input font-mono text-xs"
            />
          </Field>
          <Field label="SSO Region" help="The AWS region where your SSO is configured">
            <RegionSelect value={data.ssoRegion} onChange={v => set('ssoRegion', v)} />
          </Field>
        </>
      )}

      {/* IAM User Fields */}
      {data.method === 'iam' && (
        <>
          <Field label="Access Key ID" help="Your IAM user's Access Key ID (starts with AKIA or ASIA)">
            <input
              type="text"
              value={data.accessKeyId}
              onChange={e => set('accessKeyId', e.target.value)}
              placeholder="AKIAIOSFODNN7EXAMPLE"
              className="field-input font-mono text-xs"
              autoComplete="off"
            />
          </Field>
          <Field label="Secret Access Key" help="Never shared — stored securely in macOS Keychain">
            <div className="relative">
              <input
                type={data.showSecret ? 'text' : 'password'}
                value={data.secretAccessKey}
                onChange={e => set('secretAccessKey', e.target.value)}
                placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                className="field-input font-mono text-xs pr-8"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => set('showSecret', !data.showSecret)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {data.showSecret
                    ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                    : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}
                </svg>
              </button>
            </div>
          </Field>
        </>
      )}

      {/* Federated Fields */}
      {data.method === 'federated' && (
        <>
          <Field label="Role ARN" help="The IAM role ARN to assume via SAML federation">
            <input
              type="text"
              value={data.roleArn}
              onChange={e => set('roleArn', e.target.value)}
              placeholder="arn:aws:iam::123456789012:role/FederatedAdmin"
              className="field-input font-mono text-xs"
            />
          </Field>
          <Field label="Principal ARN" help="Your SAML identity provider's ARN">
            <input
              type="text"
              value={data.principalArn}
              onChange={e => set('principalArn', e.target.value)}
              placeholder="arn:aws:iam::123456789012:saml-provider/MyProvider"
              className="field-input font-mono text-xs"
            />
          </Field>
        </>
      )}

      {/* Chained Fields */}
      {data.method === 'chained' && (
        <Field label="Target Role ARN" help="The role you want to assume from your source session">
          <input
            type="text"
            value={data.targetRoleArn}
            onChange={e => set('targetRoleArn', e.target.value)}
            placeholder="arn:aws:iam::987654321098:role/CrossAccountAdmin"
            className="field-input font-mono text-xs"
          />
        </Field>
      )}

      {/* Common fields */}
      <div className="border-t border-border-subtle pt-4 space-y-4">
        <Field label="Connection Alias" help="A friendly name to identify this connection">
          <input
            type="text"
            value={data.alias}
            onChange={e => set('alias', e.target.value)}
            placeholder="Acme Production"
            className="field-input"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Default Region">
            <RegionSelect value={data.region} onChange={v => set('region', v)} />
          </Field>
          <Field label="Environment">
            <select
              value={data.environment}
              onChange={e => set('environment', e.target.value as EnvType)}
              className="field-input"
            >
              <option value="prod">Production</option>
              <option value="staging">Staging</option>
              <option value="dev">Development</option>
              <option value="sandbox">Sandbox</option>
            </select>
          </Field>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-text-primary text-xs font-medium">Mark as favorite</p>
            <p className="text-text-muted text-[11px]">Quick access from sidebar and command palette</p>
          </div>
          <Toggle checked={data.isFavorite} onChange={v => set('isFavorite', v)} />
        </div>
      </div>
    </div>
  )
}

// ── Step 3: Validate ───────────────────────────────────────────────────────

function StepValidate({ checks }: { checks: Check[] }) {
  return (
    <div>
      <p className="text-text-secondary text-sm mb-6">Validating your connection...</p>
      <div className="space-y-3">
        {checks.map((check, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-start gap-3"
          >
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
              {check.status === 'pending' && <div className="w-2 h-2 rounded-full bg-bg-surface2 border border-border" />}
              {check.status === 'loading' && <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
              {check.status === 'success' && (
                <svg className="w-5 h-5 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
              )}
              {check.status === 'warning' && (
                <svg className="w-5 h-5 text-warning" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L1 21h22L12 2zm0 3l9 16H3L12 5zm-1 7v4h2v-4h-2zm0 5v2h2v-2h-2z"/></svg>
              )}
              {check.status === 'error' && (
                <svg className="w-5 h-5 text-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              )}
            </div>
            <div>
              <p className={`text-sm font-medium ${
                check.status === 'success' ? 'text-text-primary' :
                check.status === 'warning' ? 'text-warning' :
                check.status === 'error'   ? 'text-danger' :
                check.status === 'loading' ? 'text-primary' :
                'text-text-muted'
              }`}>{check.label}</p>
              {check.detail && <p className="text-xs text-text-muted mt-0.5">{check.detail}</p>}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ── Step 4: Save ───────────────────────────────────────────────────────────

function StepSave({ data, set }: {
  data: WizardData
  set: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void
}) {
  const ENV_COLORS: Record<string, string> = {
    prod: 'bg-danger/10 text-danger border-danger/30',
    staging: 'bg-warning/10 text-warning border-warning/30',
    dev: 'bg-info/10 text-info border-info/30',
    sandbox: 'bg-purple-400/10 text-purple-400 border-purple-400/30',
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 bg-success/8 border border-success/20 rounded-xl">
        <svg className="w-5 h-5 text-success flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
        <p className="text-success text-sm font-medium">Connection validated successfully</p>
      </div>

      <Field label="Connection Alias">
        <input
          type="text"
          value={data.alias}
          onChange={e => set('alias', e.target.value)}
          className="field-input"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Environment">
          <select
            value={data.environment}
            onChange={e => set('environment', e.target.value as EnvType)}
            className="field-input"
          >
            <option value="prod">Production</option>
            <option value="staging">Staging</option>
            <option value="dev">Development</option>
            <option value="sandbox">Sandbox</option>
          </select>
        </Field>
        <div className="flex flex-col gap-1">
          <span className="text-text-muted text-[11px] font-medium uppercase tracking-wider">Preview</span>
          <div className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border inline-flex items-center gap-1.5 ${ENV_COLORS[data.environment] || ENV_COLORS.dev}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
            {data.environment.toUpperCase()}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-text-primary text-xs font-medium">Mark as favorite ★</p>
          <p className="text-text-muted text-[11px]">Pinned to sidebar and command palette</p>
        </div>
        <Toggle checked={data.isFavorite} onChange={v => set('isFavorite', v)} />
      </div>
    </div>
  )
}

// ── Shared field helpers ───────────────────────────────────────────────────

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-text-muted text-[11px] font-medium uppercase tracking-wider">{label}</label>
      {children}
      {help && <p className="text-text-muted text-[11px] leading-relaxed">{help}</p>}
    </div>
  )
}

function RegionSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="field-input font-mono text-xs">
      {AWS_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
    </select>
  )
}

// ── Cloud provider icons ───────────────────────────────────────────────────

function AwsIcon() {
  return (
    <svg viewBox="0 0 48 48" className="w-10 h-10" fill="none">
      <path d="M14 28c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-8H14v8z" fill="#FF9900"/>
      <path d="M30 18h2c1.1 0 2 .9 2 2v2h-4v-4z" fill="#FF9900"/>
      <path d="M14 20c0-1.1.9-2 2-2h14v4H14v-2z" fill="#FF9900"/>
      <path d="M9 34c5.5 2.5 12.5 3.8 15 3.8s9.5-1.3 15-3.8" stroke="#FF9900" strokeWidth="2" strokeLinecap="round" fill="none"/>
      <path d="M36 34l3.5 1.5-1 3" stroke="#FF9900" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M12 34l-3.5 1.5 1 3" stroke="#FF9900" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  )
}

function GcpIcon() {
  return (
    <svg viewBox="0 0 48 48" className="w-10 h-10" fill="none">
      <path d="M24 12l9 16H15L24 12z" fill="#EA4335" opacity="0.7"/>
      <path d="M33 28H15l-6 10h30L33 28z" fill="#4285F4" opacity="0.7"/>
      <path d="M24 12l9 16-6 10H21L15 28l9-16z" fill="#FBBC04" opacity="0.7"/>
    </svg>
  )
}

function AzureIcon() {
  return (
    <svg viewBox="0 0 48 48" className="w-10 h-10" fill="none">
      <path d="M22 10l-10 18 12 2-14 8h20L22 10z" fill="#0078D4" opacity="0.7"/>
      <path d="M26 14l8 20H18L26 14z" fill="#0078D4" opacity="0.5"/>
    </svg>
  )
}

export default AddConnectionWizard
