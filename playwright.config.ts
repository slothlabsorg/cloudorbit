import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  outputDir: './screenshots/artifacts',
  snapshotDir: './screenshots/snapshots',
  timeout: 15_000,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'screenshots/report', open: 'never' }],
  ],

  use: {
    baseURL: 'http://localhost:1420',
    // Match the Tauri window dimensions exactly
    viewport: { width: 1020, height: 700 },
    // Dark color scheme like the app
    colorScheme: 'dark',
    screenshot: 'only-on-failure',
    // Enough time for React + animations to settle
    actionTimeout: 5_000,
  },

  projects: [
    {
      name: 'cloudorbit',
      testMatch: 'tests/screenshots.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'interactions',
      testMatch: 'tests/interactions.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Auto-start the Vite dev server
  webServer: {
    command: 'npm run dev',
    port: 1420,
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
