import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const streamsDir = path.join(repoRoot, 'streams');
const reportPath = path.join(repoRoot, 'website', 'stream-health-report.json');
const priority = ['id', 'my', 'th', 'kr', 'jp', 'sa', 'ae', 'qa', 'kw', 'bh', 'om', 'ye', 'jo', 'iq', 'lb', 'ps', 'il', 'us', 'gb', 'uk', 'ca', 'au', 'nz', 'fr', 'de', 'es', 'it'];
const perCountry = Math.max(1, Math.min(20, Number(process.argv.find((arg) => arg.startsWith('--per-country='))?.split('=')[1]) || 3));
const timeoutMs = Math.max(2000, Math.min(15000, Number(process.argv.find((arg) => arg.startsWith('--timeout='))?.split('=')[1]) || 7000));
const concurrency = Math.max(1, Math.min(32, Number(process.argv.find((arg) => arg.startsWith('--concurrency='))?.split('=')[1]) || 12));

function playlistEntries(text, countryCode) {
  const result = [];
  let name = '';
  let tvgId = '';
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('#EXTINF:')) {
      const comma = line.indexOf(',');
      const metadata = comma >= 0 ? line.slice(0, comma) : line;
      name = comma >= 0 ? line.slice(comma + 1).trim() : 'Channel';
      tvgId = metadata.match(/tvg-id="([^"]*)"/i)?.[1] || '';
    } else if (/^https?:\/\//i.test(line)) {
      if (name) result.push({ countryCode: countryCode.toUpperCase(), name, tvgId, url: line });
      name = '';
      tvgId = '';
    }
  }
  return result;
}

async function withLimit(items, limit, worker) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      out[index] = await worker(items[index], index);
    }
  }));
  return out;
}

async function probe(item) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  try {
    const response = await fetch(item.url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { Range: 'bytes=0-16383', 'User-Agent': 'YEGTv-StreamHealth/1.0' },
    });
    const reader = response.body?.getReader();
    let chunkText = '';
    if (reader) {
      const { value } = await reader.read();
      if (value) chunkText = new TextDecoder().decode(value.slice(0, 16384));
      // Do not block the whole check on a remote server that stalls while closing a stream.
      reader.cancel().catch(() => {});
    }
    const contentType = response.headers.get('content-type') || '';
    const looksLikeManifest = /#EXTM3U/i.test(chunkText) || /mpegurl/i.test(contentType);
    const htmlPage = /text\/html/i.test(contentType) || /^\s*<!doctype html|^\s*<html/i.test(chunkText);
    const ok = response.ok && !htmlPage && (looksLikeManifest || /video\//i.test(contentType) || /octet-stream/i.test(contentType));
    return {
      ...item,
      status: response.status,
      latencyMs: Math.round(performance.now() - started),
      contentType,
      verdict: ok ? (looksLikeManifest ? 'manifest-reachable' : 'http-reachable-check-playback') : (response.ok ? 'not-a-stream-response' : 'http-error'),
      note: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      ...item,
      status: null,
      latencyMs: Math.round(performance.now() - started),
      verdict: error?.name === 'AbortError' ? 'timeout' : 'network-error',
      note: error?.name === 'AbortError' ? `Melebihi batas ${timeoutMs} ms` : (error?.message || 'Network error'),
    };
  } finally {
    clearTimeout(timer);
    // Abort the response body too, because some origins never finish closing a live response.
    controller.abort();
  }
}

async function main() {
  const files = (await readdir(streamsDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && /^([a-z]{2})(?:_|\.)/i.test(entry.name) && /\.m3u8?$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const byCountry = new Map();
  for (const file of files) {
    const code = file.match(/^([a-z]{2})/i)?.[1]?.toLowerCase();
    if (!code || !priority.includes(code)) continue;
    const text = await readFile(path.join(streamsDir, file), 'utf8');
    const list = playlistEntries(text, code);
    if (!byCountry.has(code)) byCountry.set(code, []);
    byCountry.get(code).push(...list);
  }

  const candidates = [];
  const seenUrls = new Set();
  for (const code of priority) {
    const list = byCountry.get(code) || [];
    const chosen = [];
    for (const item of list) {
      if (seenUrls.has(item.url)) continue;
      seenUrls.add(item.url);
      chosen.push(item);
      if (chosen.length >= perCountry) break;
    }
    candidates.push(...chosen);
  }
  if (!candidates.length) throw new Error('Tidak ada entri stream dari playlist prioritas.');

  console.log(`Menguji ${candidates.length} URL dari wilayah prioritas; timeout ${timeoutMs} ms, concurrency ${concurrency}.`);
  console.log('Tes HTTP ini hanya menguji keterjangkauan manifest/sumber, bukan menjamin playback/CORS/geoblocking di browser.');
  const results = await withLimit(candidates, concurrency, probe);
  const summary = results.reduce((acc, item) => {
    acc[item.verdict] = (acc[item.verdict] || 0) + 1;
    return acc;
  }, {});
  const report = {
    generatedAt: new Date().toISOString(),
    tested: results.length,
    perCountry,
    timeoutMs,
    note: 'HTTP availability does not guarantee browser playback. CORS, mixed content, geo restrictions, referer/user-agent requirements, DRM, and intermittent source outages require separate verification.',
    summary,
    results,
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log('Summary:', summary);
  console.log(`Laporan disimpan: ${reportPath}`);
  for (const item of results) console.log(`${item.verdict.padEnd(30)} ${String(item.status || '—').padEnd(4)} ${String(item.latencyMs).padStart(5)}ms  ${item.countryCode}  ${item.name}  ${item.url}`);
}

main().catch((error) => {
  console.error(`Pemeriksaan stream gagal: ${error.message}`);
  process.exitCode = 1;
});
