# YEGTv Website — server-rendered multi-page app

## Vercel settings

- **Root Directory:** `website`
- **Framework Preset:** Next.js
- **Build Command:** `npm run build` (or Vercel default)
- **Output Directory:** leave as default; do not use `dist`
- **Node.js:** 22.x recommended

The website uses Next.js App Router and request-rendered route handling (`dynamic = 'force-dynamic'`), not Vite's static `index.html` fallback. Do not add a catch-all rewrite to `/index.html`, because Next.js handles routes itself.

## Pages

- `/` — Beranda
- `/jelajah` — katalog, pencarian, dan filter channel
- `/siaran` — pemutar siaran serta daftar pilihan channel
- `/favorit` — channel yang disimpan di browser
- `/tentang` — informasi dan kebijakan sumber playlist
- `/channel/:slug?url=...` — detail channel dengan URL yang dapat dibagikan

The `prebuild` script creates `public/channels.json` from `../streams` when that folder is available. If Vercel's selected Root Directory does not expose files outside `website`, the generator falls back to reading playlists from the configured GitHub repository. Channel favourites are stored locally in the visitor's browser; the catalogue itself is generated from the repository's public playlists.


## Quick server check

After deployment, open `/api/health`. A healthy deployment returns JSON with `ok: true`, the generated catalog count, source playlist file count, and generation time. If this route returns HTTP 503, inspect the Vercel build log for `sync:channels`. This endpoint checks YEGTv's app/catalog only; it does not claim that every third-party broadcaster stream is online.
