# YEGTv — Server-rendered multi-page TV app

YEGTv is a glassmorphism live-TV catalogue built with Next.js App Router. It has distinct URL routes for home, browse, live playback, favourites, information, and each channel's detail page. Route rendering is forced to run on the server; client interactions handle search, favourites, and stream playback.

## Main features

- Glass UI with a darker backdrop, translucent panels, blur, and ambient colour around the video player.
- Separate routes: `/`, `/jelajah`, `/siaran`, `/favorit`, `/tentang`, and `/channel/:slug?url=...`.
- Search by channel, country, category, country/category filtering, and incremental rendering for large catalogs.
- Favourites stored in the visitor's browser.
- HLS playback with `hls.js`, plus native HLS where supported.
- Playlist sync from `.m3u` / `.m3u8` files in the repository's `streams/` directory, generating `public/channels.json` before development and build.
- Errors shown when streams are unavailable; no proxy to bypass CORS, geo restrictions, authentication, or broadcaster controls.

## Repository layout

Keep the original IPTV repository configuration and folders in the repository root. The website has its own package manifest and app code:

```text
tv/
├── streams/                    # IPTV playlist source files
├── scripts/                    # IPTV project scripts
├── package.json                # Original IPTV package — keep separate
└── website/
    ├── app/
    │   ├── layout.jsx
    │   ├── page.jsx             # Beranda
    │   ├── jelajah/page.jsx
    │   ├── siaran/page.jsx
    │   ├── favorit/page.jsx
    │   ├── tentang/page.jsx
    │   ├── channel/[slug]/page.jsx
    │   └── _components/AppPage.jsx
    ├── scripts/sync-channels.mjs
    ├── public/                  # channels.json generated before build
    ├── src/
    │   ├── App.jsx
    │   ├── styles.css
    │   ├── components/VideoPlayer.jsx
    │   └── lib/playlist.js
    └── package.json
```

## Run locally

Use Node.js 20.9 or newer (Node.js 22 is recommended):

```bash
cd website
npm install
npm run dev
```

The `predev` hook syncs playlist data and generates `public/channels.json`. The first sync requires access to the GitHub API and raw playlist URLs if the sibling `../streams` folder is unavailable.

Other commands:

```bash
npm run sync:channels
npm run build
npm start
```

The playlist source defaults to `projectirbie-web/tv`, branch `main`. It can be changed with `IPTV_GITHUB_OWNER`, `IPTV_GITHUB_REPO`, and `IPTV_GITHUB_BRANCH`.

## Deploy on Vercel

1. Open the Vercel project for the existing repository.
2. Set **Root Directory** to `website`.
3. Select **Next.js** as the framework preset (usually auto-detected).
4. Leave Output Directory at the Next.js default; do not set it to `dist`.
5. Use Node.js 22.x and redeploy.

Do not add a catch-all rewrite to `/index.html`. Next.js App Router handles page URLs and renders each route per request. The root IPTV `package.json` remains separate from the website's dependencies.

## Streaming limitations

- A playlist entry is not proof that a stream is online or authorized for redistribution.
- Some streams are offline, geo-restricted, HTTP-only, or require headers that a browser player cannot freely set.
- Playback can be blocked by CORS, mixed content, expired links, or provider policy.
- YEGTv does not host or transcode original streams. Only publish channels you are permitted to access and display.
