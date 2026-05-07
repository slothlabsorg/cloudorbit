# Netlify Function — CloudOrbit Updater

This folder contains the Tauri auto-updater endpoint, deployed as a Netlify Function
on the [slothlabs/slothlabs-site](https://github.com/slothlabs/slothlabs-site) repo.

**Live endpoint:** `https://slothlabs.org/cloudorbit/{{target}}/{{current_version}}`

---

## How it works

Tauri calls the endpoint on app launch. The function:

1. Fetches the latest **published** release from GitHub (drafts are invisible)
2. Finds the `latest.json` asset uploaded by `tauri-action`
3. Returns 200 + that JSON if the requested platform is present
4. Returns 204 No Content if no update or platform not found

Tauri then compares the returned version against the running version and shows
the `UpdaterModal` only if a newer version is available.

---

## Deploy (one-time setup)

Copy the two files into the website repo:

```bash
# From this repo
cp distribute/netlify/functions/updater.js  ../slothlabs-site/netlify/functions/updater.js
```

Add this to `netlify.toml` in the website repo — the `/cloudorbit/*` redirect
**must come before** the SPA catch-all `/*`:

```toml
[functions]
  directory = "netlify/functions"

# Tauri updater — must be before the /* catch-all
[[redirects]]
  from   = "/cloudorbit/*"
  to     = "/.netlify/functions/updater"
  status = 200
  force  = true

# SPA fallback (keep existing)
[[redirects]]
  from   = "/*"
  to     = "/index.html"
  status = 200
```

Push to the website repo. Netlify will deploy the function automatically.

---

## Test locally

```bash
cd ../slothlabs-site
npm install -g netlify-cli   # once
netlify dev                  # http://localhost:8888

# Before any published release → 204 (expected)
curl -i http://localhost:8888/cloudorbit/darwin-aarch64/0.0.0

# After publishing a release → 200 + JSON
curl http://localhost:8888/cloudorbit/darwin-aarch64/0.0.0 | jq .
```

---

## Keeping in sync

When the function logic needs updating, edit `distribute/netlify/functions/updater.js`
in this repo and copy it over to the website repo. The function rarely needs changes —
only if GitHub's API response shape or the `latest.json` format changes.
