import type { NewsFeed } from '@/types/news'

// ── Mock / fallback feed ─────────────────────────────────────────────────────
// This data is shown when the remote feed is unreachable (no internet, dev
// mode, Playwright tests). It also acts as the reference for what a real
// feed payload looks like.
//
// Deploy the real feed at: https://slothlabs.org/news/feed.json
// Format must match the NewsFeed interface in src/types/news.ts

export const MOCK_FEED: NewsFeed = {
  version: 1,
  items: [
    {
      id: 'co-v110-release',
      type: 'changelog',
      priority: 10,
      publishedAt: '2026-05-15T00:00:00Z',
      badge: 'UPDATE',
      badgeTone: 'primary',
      title: 'CloudOrbit v1.1.0',
      body: `## What's new\n\n- **Session persistence** — active sessions survive app restarts\n- **Region selector** — pick any AWS region when starting a session\n- **IAM / Chained / Federated** — full backend implementation with LocalStack test suite\n- **Sidebar cycling** — all active sessions cycle in the sidebar and status bar\n- **Environment tag fix** — dropdown no longer clips at the bottom of the window\n- **Credentials file** — selected region is now written to \`~/.aws/credentials\``,
      collapsed: false,
      action: { label: 'Full changelog', url: 'https://github.com/slothlabs/cloudorbit/blob/main/CHANGELOG.md' },
      targetApps: ['cloudorbit'],
    },
    {
      id: 'co-tip-cycling',
      type: 'tip',
      priority: 7,
      publishedAt: '2026-05-14T00:00:00Z',
      badge: 'TIP',
      badgeTone: 'success',
      title: 'Managing multiple active sessions',
      body: `Running sessions in different AWS accounts at the same time? The sidebar and status bar now **cycle through all active sessions** every 5 seconds so you always know what's running.\n\nClick either indicator to jump straight to the Sessions tab.`,
      targetApps: ['cloudorbit'],
    },
    {
      id: 'co-localstack-testing',
      type: 'announcement',
      priority: 6,
      publishedAt: '2026-05-13T00:00:00Z',
      badge: 'NEW',
      badgeTone: 'primary',
      title: 'Non-SSO auth now fully tested',
      body: `IAM User, Chained role, and Federated (WebIdentity) authentication flows now have complete backend implementations, unit tests, and LocalStack integration tests.\n\nIf you're on a network that doesn't use AWS SSO, you can now connect via any of the four supported methods.`,
      action: { label: 'Read the docs', url: 'https://slothlabs.org/cloudorbit/docs' },
      targetApps: ['cloudorbit'],
    },
    {
      id: 'slothlabs-roadmap-2026',
      type: 'news',
      priority: 5,
      publishedAt: '2026-05-10T00:00:00Z',
      badge: 'NEW',
      badgeTone: 'neutral',
      title: 'SlothLabs 2026 roadmap',
      body: `We're building a suite of developer tools that make cloud access simpler and safer. CloudOrbit is the first — here's what's coming next:\n\n- **CloudOrbit Pro** — team vaults, shared sessions, audit logs\n- **CloudWatch Companion** — log tailing and alerts in your menu bar\n- **Multi-cloud** — GCP and Azure support (preview)\n\nWe release fast and often. Star the repo to stay updated.`,
      collapsed: true,
      action: { label: 'Follow SlothLabs', url: 'https://github.com/slothlabs' },
      targetApps: ['all'],
    },
    {
      id: 'co-sponsor-placeholder',
      type: 'ad',
      priority: 3,
      publishedAt: '2026-05-01T00:00:00Z',
      badge: 'SPONSOR',
      badgeTone: 'neutral',
      title: 'Want to reach cloud engineers?',
      body: `CloudOrbit is used by developers managing AWS access daily. If your tool, service, or course targets cloud engineers, **your ad could appear here**.\n\nSponsored placements are clearly labeled and help fund development.`,
      sponsored: true,
      action: { label: 'Advertise with SlothLabs', url: 'https://slothlabs.org/advertise' },
      targetApps: ['all'],
    },
  ],
}
