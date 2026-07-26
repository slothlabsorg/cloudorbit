import type { NewsFeed } from '@/types/news'

// ── Mock / fallback feed ─────────────────────────────────────────────────────
// This data is shown when the remote feed is unreachable (no internet, dev
// mode, Playwright tests). It also acts as the reference for what a real
// feed payload looks like.
//
// Deploy the real feed at: https://slothlabs.org/news/feed.json
// Format must match the NewsFeed interface in src/types/news.ts

// Empty mock — no fallback content shown when the remote feed is unreachable.
// The app will show an empty state with a "Try again" button instead of
// stale/invented items. Use ?mock=1 in dev to test the UI with no real feed.
export const MOCK_FEED: NewsFeed = {
  version: 1,
  items: [],
}
