# YEGTv stream reliability and captions

## Playback architecture

- The browser requests the original source manifest directly. This avoids routing continuous media segments through a serverless function, which adds a hop, bandwidth cost, and another point of failure.
- The player uses bounded HLS timeouts, modest live buffers, one media recovery attempt, and up to three same-channel HTTPS mirrors when the playlist includes multiple `tvg-id` sources.
- If a source is plain HTTP on an HTTPS website, modern browsers block it as mixed content. The player tries HTTPS mirrors and explains the reason if none exists.
- The root Next.js layout keeps the application and catalog in memory while navigating between page routes, instead of re-fetching the full channel catalog at each route change.
- The generated catalog is minified and prioritized for Indonesia, Malaysia, Thailand, South Korea, Japan, the Arabian region, and then Western markets.

## Checking source health

Run from `website/`:

```bash
npm run check:streams -- --per-country=3 --timeout=7000 --concurrency=12
```

The script writes `stream-health-report.json` in the repository root's `website/` directory. Increase `--per-country` to check more sources or pass `--per-country=20` for a broader sample. This is an HTTP reachability check; it is not a guarantee that the stream will play in every browser or region. CORS, provider authentication, DRM, expired URLs, geo restrictions, and source-side outages can still prevent playback.

## VPN and proxies

YEGTv intentionally does not send all video through a VPN or a Vercel function proxy. A forced tunnel can increase latency and bandwidth usage, and it cannot revive an offline provider. Use a lawful network connection and only sources that the provider permits you to watch. A source's regional restrictions should be respected rather than bypassed.

## Subtitles

The player detects subtitle tracks declared by the original HLS stream, automatically selects a track identified as Indonesian when one exists, and lets viewers choose other tracks. If no Indonesian track is provided, the player does not fabricate translated dialogue. Real-time Indonesian subtitles for sources without captions require a speech-recognition and translation service, an authorized way to process the media, credentials, and extra compute/latency; this is not enabled by default.
