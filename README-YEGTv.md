# YEGTv — React/Vite Live TV

A responsive live-TV frontend inspired by the supplied muted blue-grey streaming UI reference. Includes a channel discovery home page, poster-style channel cards, search and filters, favorites, and an ambient glow player mode.

## What is included

- **YEGTv branding and theme**: blue-grey glass surfaces, wide featured channel banners, scrolling category pills, and portrait channel cards.
- **Ambient mode**: samples low-resolution video frames where browser security allows it and uses their average colors for a soft, blurred glow behind the player. A channel-colour fallback keeps the effect available when sampling is restricted. Ambient mode can be toggled on/off from the player.
- A sync script that reads `.m3u` / `.m3u8` playlists in the existing `streams/` folder from `projectirbie-web/tv` and combines valid entries into `website/public/channels.json`.
- HLS playback with `hls.js`, plus native HLS where supported.
- Search by channel / country / category, country and category filters, favorites in browser storage, and incremental rendering for large catalogs.
- Error messaging when a stream is unavailable; no proxy intended to bypass CORS, geo restrictions, authentication, or broadcaster controls.

## Add it to your existing repository

1. Extract this ZIP.
2. Copy the included `website/` directory into the root of `https://github.com/projectirbie-web/tv`.
3. **Keep the repository's root `package.json` unchanged.** The new frontend lives in a subfolder, so it does not replace the IPTV repository's original scripts.
4. Commit and push `website/`.

Expected layout:

```text
tv/
├── streams/                 # Existing IPTV source playlists
├── scripts/                 # Existing playlist scripts
├── package.json             # Keep this file
└── website/                 # New YEGTv React/Vite app
    ├── scripts/sync-channels.mjs
    ├── public/
    ├── src/
    ├── package.json
    ├── index.html
    └── vite.config.js
```

## Run locally

Use Node.js 20 or newer:

```bash
cd website
npm install
npm run dev
```

The `predev` hook syncs the repository playlists and creates `public/channels.json` before Vite starts. The first sync needs internet access to GitHub API and raw playlist URLs.

Other commands:

```bash
npm run sync:channels
npm run build
npm run preview
```

If the GitHub repository owner, name, or branch changes, configure `IPTV_GITHUB_OWNER`, `IPTV_GITHUB_REPO`, and `IPTV_GITHUB_BRANCH`. Defaults are `projectirbie-web`, `tv`, and `main`.

## Deploy on Vercel

1. Import or open the existing GitHub repository in Vercel.
2. Set **Root Directory** to `website`.
3. Select the Vite framework preset.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Redeploy and check the build logs to ensure `sync:channels` generated `channels.json` successfully.

## Ambient mode notes

The player does not open a second copy of each stream. When the browser permits drawing frames to a canvas, YEGTv samples a tiny frame and uses its colours for the blurred ambient glow. If a provider/browser security policy blocks reading pixels (for example, a canvas security exception), the player gracefully keeps a deterministic colour glow based on the selected channel. The stream itself is not modified.

## Streaming limitations

- An M3U entry is only a playlist URL, not proof that a stream is online or authorized for redistribution.
- Some streams are offline, geo-restricted, HTTP-only, or require a Referer/User-Agent header that a browser player cannot freely set.
- A browser can be blocked by CORS, mixed-content rules, expired links, or provider policies.
- YEGTv does not host, transcode, or create the original live feed. The stream provider serves video to viewers.
- Only publish channels you are permitted to access and display.

## Troubleshooting

- **Playlist sync fails:** check internet access, repository visibility, branch name, and GitHub API rate limits. If a generated `public/channels.json` already exists it may be used as a fallback, depending on the sync script result.
- **A channel has a black screen:** try another channel; some playlist entries may be inactive or browser-incompatible.
- **No channels appear after deployment:** inspect Vercel's build log for `sync:channels`, confirm Root Directory is `website`, and confirm `channels.json` exists in the deployed `dist` output.
- **Ambient glow does not follow video colours:** some native-HLS and cross-origin streams prevent canvas pixel reads. The channel-colour fallback will still be shown.
