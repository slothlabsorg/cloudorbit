import { test } from '@playwright/test'

test('bell dropdown open', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/?mock=1&screen=orbit&news=1')
  await page.waitForSelector('.text-text-primary', { timeout: 8000 })
  await page.waitForTimeout(500)
  await page.click('[data-testid="news-bell"]')
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'screenshots/bell-open.png' })
})

test('bell with update item after dismiss', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/?mock=1&screen=orbit&mockUpdate=1&news=1')
  await page.waitForSelector('.text-text-primary', { timeout: 8000 })
  await page.waitForTimeout(600)
  const later = page.getByText('Later', { exact: true }).first()
  if (await later.count() > 0) { await later.click(); await page.waitForTimeout(400) }
  await page.click('[data-testid="news-bell"]')
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'screenshots/bell-update-item.png' })
})
