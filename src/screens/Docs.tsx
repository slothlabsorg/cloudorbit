import React, { useState } from 'react'

type DocSection = 'getting-started' | 'aws-setup' | 'sso-config' | 'kubeconfig' | 'troubleshoot'

interface DocItem {
  id: DocSection
  label: string
  icon: React.ReactNode
}

const docNav: DocItem[] = [
  {
    id: 'getting-started',
    label: 'Getting Started',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>
    ),
  },
  {
    id: 'aws-setup',
    label: 'AWS Setup',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="14" rx="2"/>
        <path d="M3 20h18"/>
      </svg>
    ),
  },
  {
    id: 'sso-config',
    label: 'SSO Configuration',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
      </svg>
    ),
  },
  {
    id: 'kubeconfig',
    label: 'Kubeconfig',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>
      </svg>
    ),
  },
  {
    id: 'troubleshoot',
    label: 'Troubleshooting',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
  },
]

function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="relative group rounded-xl bg-bg-base border border-border overflow-hidden my-3">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-bg-elevated">
        <span className="text-text-muted text-[10px] font-mono uppercase">{language}</span>
        <button
          onClick={copy}
          className="text-text-muted hover:text-primary text-[10px] flex items-center gap-1 transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="px-4 py-3 text-xs font-mono text-text-secondary overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-text-primary font-display font-bold text-sm mb-2 mt-5">{children}</h2>
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-text-secondary text-xs leading-relaxed mb-2">{children}</p>
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-text-secondary text-xs leading-relaxed">
      <span className="text-primary mt-0.5 flex-shrink-0">•</span>
      <span>{children}</span>
    </li>
  )
}

const docContent: Record<DocSection, React.ReactNode> = {
  'getting-started': (
    <div>
      <P>
        CloudOrbit is a desktop app for engineers who manage multiple cloud accounts and environments.
        Connect once, then switch between accounts, roles, and clusters with a single click — no terminal required.
      </P>
      <P>
        <strong className="text-text-primary">Currently supported:</strong> AWS (IAM Identity Center / SSO).
        GCP and Azure support is on the roadmap.
      </P>
      <H2>Prerequisites</H2>
      <ul className="space-y-1 mb-3">
        <Li>A supported cloud provider account (see below)</Li>
        <Li>macOS 10.15+, Windows 10+, or Linux</Li>
        <Li>kubectl (optional — only needed for Kubernetes features)</Li>
      </ul>
      <H2>Quick Start — AWS</H2>
      <P>1. Configure AWS SSO in <code className="font-mono text-primary">~/.aws/config</code> (see AWS Setup)</P>
      <P>2. Launch CloudOrbit — it reads your config automatically</P>
      <P>3. Click a profile row to start a session</P>
      <P>4. Approve the browser login prompt</P>
      <P>5. Your session is active — credentials are written to <code className="font-mono text-primary">~/.aws/credentials</code></P>
    </div>
  ),
  'aws-setup': (
    <div>
      <P>CloudOrbit reads your existing <code className="font-mono text-primary">~/.aws/config</code> file. No extra setup is needed if you already use the AWS CLI with SSO.</P>
      <H2>Install AWS CLI v2</H2>
      <CodeBlock code={`# macOS (Homebrew)
brew install awscli

# Verify
aws --version`} />
      <H2>Configure SSO Session</H2>
      <CodeBlock code={`aws configure sso

# Follow the prompts to set:
# - SSO start URL
# - SSO region
# - Default region
# - Output format`} />
      <H2>Verify Configuration</H2>
      <CodeBlock code={`# View your config
cat ~/.aws/config

# Test SSO login
aws sso login --profile your-profile`} />
      <div className="mt-4 px-3 py-2.5 rounded-xl bg-bg-surface border border-border-subtle">
        <p className="text-text-muted text-[10px] font-semibold uppercase tracking-wider mb-1">Coming soon</p>
        <p className="text-text-secondary text-xs">GCP (gcloud / Workload Identity) and Azure (Entra ID / service principals) setup guides will appear here when those providers launch.</p>
      </div>
    </div>
  ),
  'sso-config': (
    <div>
      <P>CloudOrbit supports the AWS SSO session format. Both the current <code className="font-mono text-primary">sso-session</code> block style and the legacy inline style are recognised.</P>
      <H2>New Format (Recommended)</H2>
      <CodeBlock language="ini" code={`[sso-session my-company]
sso_start_url = https://my-company.awsapps.com/start
sso_region = us-east-1
sso_registration_scopes = sso:account:access

[profile production-admin]
sso_session = my-company
sso_account_id = 123456789012
sso_role_name = AdministratorAccess
region = us-east-1

[profile staging-developer]
sso_session = my-company
sso_account_id = 234567890123
sso_role_name = DeveloperAccess
region = us-east-1`} />
      <H2>Legacy Format</H2>
      <CodeBlock language="ini" code={`[profile legacy-profile]
sso_start_url = https://my-company.awsapps.com/start
sso_region = us-east-1
sso_account_id = 123456789012
sso_role_name = AdministratorAccess
region = us-east-1`} />
    </div>
  ),
  'kubeconfig': (
    <div>
      <P>CloudOrbit can discover and activate Kubernetes clusters. Clicking "Activate" writes a new context to <code className="font-mono text-primary">~/.kube/config</code> — your existing contexts are preserved.</P>
      <H2>AWS — EKS</H2>
      <P>CloudOrbit calls the EKS DescribeCluster API to fetch the endpoint and CA certificate, then writes a kubeconfig entry that uses <code className="font-mono text-primary">aws eks get-token</code> for authentication.</P>
      <H2>Required IAM permissions</H2>
      <CodeBlock language="json" code={`{
  "Effect": "Allow",
  "Action": [
    "eks:ListClusters",
    "eks:DescribeCluster"
  ],
  "Resource": "*"
}`} />
      <H2>Verify cluster access</H2>
      <CodeBlock code={`kubectl get nodes
kubectl get namespaces`} />
      <H2>Production safety</H2>
      <P>CloudOrbit shows a confirmation dialog before activating production cluster contexts. Configure this in Settings → Kubernetes Safety.</P>
      <div className="mt-4 px-3 py-2.5 rounded-xl bg-bg-surface border border-border-subtle">
        <p className="text-text-muted text-[10px] font-semibold uppercase tracking-wider mb-1">Coming soon</p>
        <p className="text-text-secondary text-xs">GKE (Google Kubernetes Engine) and AKS (Azure Kubernetes Service) cluster discovery will be added alongside those provider launches.</p>
      </div>
    </div>
  ),
  'troubleshoot': (
    <div>
      <H2>Session token expired or missing</H2>
      <P>If you see "Not logged in", the SSO token has expired. Click the profile row to open a fresh browser login.</P>
      <H2>Credentials not working</H2>
      <CodeBlock code={`# Verify credentials were written
cat ~/.aws/credentials

# Test with the AWS CLI
aws sts get-caller-identity --profile your-profile`} />
      <H2>Cluster not appearing</H2>
      <P>Click "Detect Clusters" on the Clusters screen. For EKS, confirm your IAM role has <code className="font-mono text-primary">eks:ListClusters</code> and <code className="font-mono text-primary">eks:DescribeCluster</code>.</P>
      <H2>kubectl returns "Unauthorized"</H2>
      <P>Your IAM role needs to be mapped in the cluster's <code className="font-mono text-primary">aws-auth</code> ConfigMap. Ask your cluster admin to run:</P>
      <CodeBlock code={`eksctl create iamidentitymapping \\
  --cluster my-cluster \\
  --region us-east-1 \\
  --arn arn:aws:iam::123456789012:role/MyRole \\
  --group system:masters \\
  --username my-username`} />
      <H2>SSO login opens wrong browser</H2>
      <P>CloudOrbit uses the system default browser. Change it in macOS System Settings → General → Default web browser, or Windows Settings → Default apps.</P>
    </div>
  ),
}

export function Docs(_props: {}) {
  const [activeDoc, setActiveDoc] = useState<DocSection>('getting-started')

  return (
    <div className="flex h-full overflow-hidden">
      {/* Doc nav */}
      <div className="w-52 flex-shrink-0 border-r border-border bg-bg-elevated overflow-y-auto">
        <div className="p-3">
          <p className="text-text-muted text-[10px] font-semibold uppercase tracking-wider px-2 mb-2">Documentation</p>
          {docNav.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveDoc(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors mb-0.5 text-left ${
                activeDoc === item.id
                  ? 'bg-primary/10 text-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface'
              }`}
            >
              {item.icon}
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Doc content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <h1 className="font-display font-bold text-text-primary text-base mb-4">
          {docNav.find(d => d.id === activeDoc)?.label}
        </h1>
        <div className="max-w-2xl">
          {docContent[activeDoc]}
        </div>
      </div>
    </div>
  )
}

export default Docs
