/**
 * CloudOrbit — Tauri v2 update endpoint (Netlify Function)
 *
 * Tauri calls:
 *   GET /cloudorbit/{{target}}/{{current_version}}
 *   e.g. GET /cloudorbit/darwin-aarch64/0.1.0
 *
 * Returns:
 *   200 + latest.json body  → update available
 *   204 No Content          → no update / target not found
 *
 * The response is cached for 5 minutes at Netlify's CDN edge via
 * Cache-Control headers (set Netlify's "Cache" plugin or just rely on
 * the CDN respecting public max-age).
 */

const GITHUB_REPO = 'slothlabs/cloudorbit'

exports.handler = async (event) => {
  // event.path is the original path before the redirect, e.g.:
  //   /cloudorbit/darwin-aarch64/0.1.0
  const parts = event.path.replace(/^\//, '').split('/')

  // Support both /cloudorbit/target/version (3 parts) and /target/version (2 parts)
  const [, target] = parts.length >= 3 ? parts : [null, ...parts]

  try {
    // Fetch latest published release from GitHub
    const ghResp = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      {
        headers: {
          'User-Agent': 'cloudorbit-updater/1.0',
          'Accept':     'application/vnd.github.v3+json',
        },
      }
    )

    if (!ghResp.ok) return { statusCode: 204 }

    const release = await ghResp.json()

    // tauri-action uploads a latest.json asset with platform URLs + signatures
    const asset = release.assets?.find(a => a.name === 'latest.json')
    if (!asset) return { statusCode: 204 }

    const latestResp = await fetch(asset.browser_download_url)
    if (!latestResp.ok) return { statusCode: 204 }

    const latestJson = await latestResp.json()

    // If the requesting platform isn't in the release, return no-update
    if (target && latestJson.platforms && !latestJson.platforms[target]) {
      return { statusCode: 204 }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type':                'application/json',
        'Access-Control-Allow-Origin': '*',
        // Cache at CDN edge for 5 min; re-check after that
        'Cache-Control':               'public, max-age=300, stale-while-revalidate=60',
      },
      body: JSON.stringify(latestJson),
    }
  } catch (err) {
    console.error('updater function error:', err)
    return { statusCode: 204 }
  }
}
