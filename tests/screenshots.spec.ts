/**
 * CloudOrbit — Visual Snapshot Suite
 *
 * Captures every screen + key interaction state with mock data.
 * Run: npm run screenshots
 * View: open screenshots/  (PNG files)
 */
import { test, type Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

// ── helpers ──────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const OUT = path.resolve(__dirname, '../screenshots')
const BASE = '/?mock=1'

function url(screen: string, extra = '') {
  return `${BASE}&screen=${screen}${extra}`
}

async function goto(page: Page, screen: string, extra = '') {
  await page.goto(url(screen, extra))
  // Wait for React to render (no loading skeletons)
  await page.waitForSelector('[data-testid="app-ready"], .text-text-primary', { timeout: 8000 })
  // Let Framer Motion settle
  await page.waitForTimeout(400)
}

async function snap(page: Page, name: string) {
  const filePath = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: filePath, fullPage: false })
  console.log(`  ✓  ${name}.png`)
}

// Ensure output dir exists
test.beforeAll(() => {
  fs.mkdirSync(OUT, { recursive: true })
  console.log(`\n📸  Screenshots → ${OUT}\n`)
})

// ── Orbit screen ─────────────────────────────────────────────────────────────

test('orbit — default (4 sessions, all states)', async ({ page }) => {
  await goto(page, 'orbit')
  await snap(page, '01-orbit-default')
})

test('orbit — detail panel open', async ({ page }) => {
  await goto(page, 'orbit', '&detail=1')
  await snap(page, '02-orbit-detail-panel')
})

test('orbit — sidebar collapsed', async ({ page }) => {
  await goto(page, 'orbit')
  // Click the collapse toggle in sidebar
  const toggle = page.locator('[data-testid="sidebar-collapse"], button[title*="collapse" i], button[aria-label*="collapse" i]').first()
  if (await toggle.count() > 0) {
    await toggle.click()
    await page.waitForTimeout(350)
  }
  await snap(page, '03-orbit-sidebar-collapsed')
})

test('orbit — row hover (first row)', async ({ page }) => {
  await goto(page, 'orbit')
  // Hover over the first account row
  const firstRow = page.locator('tr, [data-row], .account-row').first()
  if (await firstRow.count() > 0) {
    await firstRow.hover()
    await page.waitForTimeout(200)
  }
  await snap(page, '04-orbit-row-hover')
})

// ── Sessions screen ───────────────────────────────────────────────────────────

test('sessions — all tab', async ({ page }) => {
  await goto(page, 'sessions')
  await snap(page, '05-sessions-all')
})

test('sessions — active tab', async ({ page }) => {
  await goto(page, 'sessions')
  // Click "Active" tab
  const activeTab = page.getByText('Active', { exact: false }).first()
  if (await activeTab.count() > 0) {
    await activeTab.click()
    await page.waitForTimeout(200)
  }
  await snap(page, '06-sessions-active-tab')
})

test('sessions — expired tab', async ({ page }) => {
  await goto(page, 'sessions')
  const expiredTab = page.getByText('Expired', { exact: false }).first()
  if (await expiredTab.count() > 0) {
    await expiredTab.click()
    await page.waitForTimeout(200)
  }
  await snap(page, '07-sessions-expired-tab')
})

// ── Clusters screen ───────────────────────────────────────────────────────────

test('clusters — default', async ({ page }) => {
  await goto(page, 'clusters')
  await snap(page, '08-clusters-default')
})

// ── Activity screen ───────────────────────────────────────────────────────────

test('activity — timeline', async ({ page }) => {
  await goto(page, 'activity')
  await snap(page, '09-activity-timeline')
})

// ── Settings screen ───────────────────────────────────────────────────────────

test('settings — appearance', async ({ page }) => {
  await goto(page, 'settings')
  await snap(page, '10-settings-appearance')
})

test('settings — kubernetes safety section', async ({ page }) => {
  await goto(page, 'settings')
  // Click the Kubernetes nav item
  const k8sNav = page.getByText('Kubernetes', { exact: false }).first()
  if (await k8sNav.count() > 0) {
    await k8sNav.click()
    await page.waitForTimeout(200)
  }
  await snap(page, '11-settings-kubernetes')
})

test('settings — security section', async ({ page }) => {
  await goto(page, 'settings')
  const secNav = page.getByText('Security', { exact: false }).first()
  if (await secNav.count() > 0) {
    await secNav.click()
    await page.waitForTimeout(200)
  }
  await snap(page, '12-settings-security')
})

// ── Docs screen ───────────────────────────────────────────────────────────────

test('docs — introduction', async ({ page }) => {
  await goto(page, 'docs')
  await snap(page, '13-docs-introduction')
})

test('docs — cloudflare troubleshooting', async ({ page }) => {
  await goto(page, 'docs')
  const cfNav = page.getByText('Cloudflare', { exact: false }).first()
  if (await cfNav.count() > 0) {
    await cfNav.click()
    await page.waitForTimeout(200)
  }
  await snap(page, '14-docs-cloudflare')
})

// ── Command palette ───────────────────────────────────────────────────────────

test('command palette — open (⌘K)', async ({ page }) => {
  await goto(page, 'orbit', '&palette=1')
  await snap(page, '15-command-palette')
})

test('command palette — search results', async ({ page }) => {
  await goto(page, 'orbit', '&palette=1')
  // Type a search query
  const input = page.locator('input[placeholder*="Search" i], input[placeholder*="search" i]').first()
  if (await input.count() > 0) {
    await input.fill('prod')
    await page.waitForTimeout(200)
  }
  await snap(page, '16-command-palette-search')
})

// ── Full composite — all screens at 1× ───────────────────────────────────────

test('composite — all screens (tall page)', async ({ page }) => {
  // This test renders a page with iframes or individual navigation to build a
  // composite overview. We'll do it as a simple summary page instead.
  await page.setViewportSize({ width: 1020, height: 700 })
  await goto(page, 'orbit')

  // Take a final summary of every nav item
  const screens: [string, string][] = [
    ['orbit',    '17a-composite-orbit'],
    ['sessions', '17b-composite-sessions'],
    ['clusters', '17c-composite-clusters'],
    ['activity', '17d-composite-activity'],
    ['settings', '17e-composite-settings'],
    ['docs',     '17f-composite-docs'],
  ]

  for (const [scr, filename] of screens) {
    await page.goto(url(scr))
    await page.waitForTimeout(500)
    await snap(page, filename)
  }
})

// ── Design system component gallery ─────────────────────────────────────────

test('orbit — expiring session highlight', async ({ page }) => {
  // The mock data has a session expiring in 22 minutes (id 3 — Platform Shared)
  // Navigate to orbit and find it in the table
  await goto(page, 'orbit')
  await snap(page, '18-expiring-session-highlight')
  // Also capture the sessions screen showing the warning state
  await page.goto(url('sessions'))
  await page.waitForTimeout(500)
  await snap(page, '19-sessions-expiry-warning')
})

// ── First launch / empty state ────────────────────────────────────────────

test('first launch — no connections (sloth + Add Connection)', async ({ page }) => {
  await page.goto('/?firstLaunch=1&screen=orbit')
  await page.waitForSelector('.text-text-primary, [data-testid="app-ready"]', { timeout: 8000 })
  await page.waitForTimeout(500)
  await snap(page, '22-first-launch-empty')
})

// ── Accounts screen ───────────────────────────────────────────────────────

test('accounts — list view', async ({ page }) => {
  await goto(page, 'accounts')
  await snap(page, '23-accounts-list')
})

test('accounts — empty state', async ({ page }) => {
  await page.goto('/?firstLaunch=1&screen=accounts')
  await page.waitForSelector('.text-text-primary', { timeout: 8000 })
  await page.waitForTimeout(400)
  await snap(page, '24-accounts-empty')
})

// ── Add Connection Wizard ─────────────────────────────────────────────────

test('add connection wizard — step 0 provider', async ({ page }) => {
  await goto(page, 'accounts')
  const btn = page.getByText('Add Connection').first()
  if (await btn.count() > 0) { await btn.click(); await page.waitForTimeout(300) }
  await snap(page, '25-wizard-provider')
})

test('add connection wizard — step 1 method', async ({ page }) => {
  await goto(page, 'accounts')
  const btn = page.getByText('Add Connection').first()
  if (await btn.count() > 0) {
    await btn.click()
    await page.waitForTimeout(300)
    const next = page.getByText('Continue →').first()
    if (await next.count() > 0) { await next.click(); await page.waitForTimeout(300) }
  }
  await snap(page, '26-wizard-method')
})

// ── Accounts detail panel ─────────────────────────────────────────────────

test('accounts — detail panel overview tab', async ({ page }) => {
  await goto(page, 'accounts')
  // Click the first account row to open the detail panel
  const firstRow = page.locator('[class*="border-b"][class*="cursor-pointer"]').first()
  if (await firstRow.count() > 0) {
    await firstRow.click()
    await page.waitForTimeout(400)
  }
  await snap(page, '27-accounts-detail-overview')
})

test('accounts — detail panel clusters tab', async ({ page }) => {
  await goto(page, 'accounts')
  const firstRow = page.locator('[class*="border-b"][class*="cursor-pointer"]').first()
  if (await firstRow.count() > 0) {
    await firstRow.click()
    await page.waitForTimeout(350)
    const clustersTab = page.getByText('Clusters', { exact: true }).first()
    if (await clustersTab.count() > 0) { await clustersTab.click(); await page.waitForTimeout(200) }
  }
  await snap(page, '28-accounts-detail-clusters')
})

test('accounts — detail panel security tab', async ({ page }) => {
  await goto(page, 'accounts')
  const firstRow = page.locator('[class*="border-b"][class*="cursor-pointer"]').first()
  if (await firstRow.count() > 0) {
    await firstRow.click()
    await page.waitForTimeout(350)
    const securityTab = page.getByText('Security', { exact: true }).first()
    if (await securityTab.count() > 0) { await securityTab.click(); await page.waitForTimeout(200) }
  }
  await snap(page, '29-accounts-detail-security')
})

// ── Sessions bulk selection ─────────────────────────────────────────────────

test('sessions — bulk selection + action bar', async ({ page }) => {
  await goto(page, 'sessions')
  // Hover over first row to reveal checkbox, then click it
  const rows = page.locator('[class*="border-b"][class*="cursor-pointer"]')
  if (await rows.count() > 0) {
    await rows.first().hover()
    await page.waitForTimeout(150)
    // Click the checkbox area (first cell)
    const firstCell = rows.first().locator('div').first()
    await firstCell.click()
    await page.waitForTimeout(300)
  }
  await snap(page, '30-sessions-bulk-selection')
})

// ── Activity filter tabs ────────────────────────────────────────────────────

test('activity — sessions filter tab', async ({ page }) => {
  await goto(page, 'activity')
  const sessionsTab = page.getByText('Sessions', { exact: true }).first()
  if (await sessionsTab.count() > 0) {
    await sessionsTab.click()
    await page.waitForTimeout(200)
  }
  await snap(page, '31-activity-sessions-filter')
})

test('activity — event detail drawer', async ({ page }) => {
  await goto(page, 'activity')
  // Click the first event row to open detail drawer
  const firstEvent = page.locator('[class*="rounded-lg"][class*="cursor-pointer"]').first()
  if (await firstEvent.count() > 0) {
    await firstEvent.click()
    await page.waitForTimeout(400)
  }
  await snap(page, '32-activity-event-detail')
})

// ── Support screen ──────────────────────────────────────────────────────────

test('support — founding page', async ({ page }) => {
  await goto(page, 'support')
  await snap(page, '33-support')
})

// ── Updater modal ──────────────────────────────────────────────────────────

test('updater modal — update available with changelog', async ({ page }) => {
  await page.goto(`${BASE}&screen=orbit&updater=1`)
  await page.waitForSelector('.text-text-primary', { timeout: 8000 })
  // Modal appears immediately in updater=1 mode
  await page.waitForTimeout(600)
  await snap(page, '34-updater-modal')
})

// ── Orbit support banner ───────────────────────────────────────────────────

test('orbit — support banner (first visit, not dismissed)', async ({ page }) => {
  // Fresh page = no localStorage → banner shows with sessions loaded in mock mode
  await goto(page, 'orbit')
  await snap(page, '35-orbit-support-banner')
})

// ── Update / news banner (marketing screenshots) ──────────────────────────────

test('orbit — update news banner visible', async ({ page }) => {
  await page.goto(`${BASE}&screen=orbit&news=1`)
  await page.waitForSelector('[data-testid="update-banner"]', { timeout: 8000 })
  await page.waitForTimeout(500)
  await snap(page, '36-orbit-update-banner')
})

test('updater modal — improved messaging with early release note', async ({ page }) => {
  await page.goto(`${BASE}&screen=orbit&updater=1`)
  await page.waitForSelector('.text-text-primary', { timeout: 8000 })
  await page.waitForTimeout(600)
  await snap(page, '37-updater-modal-early-release')
})

test('orbit — update banner with active sessions (full dashboard)', async ({ page }) => {
  await page.goto(`${BASE}&screen=orbit&news=1`)
  await page.waitForSelector('[data-testid="update-banner"]', { timeout: 8000 })
  await page.waitForTimeout(500)
  await snap(page, '38-orbit-update-banner-with-sessions')
})

// ── News screen ───────────────────────────────────────────────────────────────

test('news — feed with all card types', async ({ page }) => {
  await goto(page, 'news')
  await page.waitForTimeout(600)
  await snap(page, '39-news-feed')
})

test('news — sidebar with unread badge', async ({ page }) => {
  // ?news=1 activates mock feed so the sidebar badge is visible
  await page.goto('/?mock=1&screen=orbit&news=1')
  await page.waitForSelector('[data-testid="app-ready"], .text-text-primary', { timeout: 8000 })
  await page.waitForTimeout(400)
  await snap(page, '40-news-sidebar-unread-badge')
})

// ── Window size variations ─────────────────────────────────────────────────

test('orbit — 1400×900 (larger display)', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 })
  await goto(page, 'orbit')
  await snap(page, '20-orbit-1400x900')
})

test('orbit — 760×540 (minimum window)', async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 540 })
  await goto(page, 'orbit')
  await snap(page, '21-orbit-minimum-window')
})
