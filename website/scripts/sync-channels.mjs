import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const websiteRoot = path.resolve(__dirname, '..');
const outputFile = path.join(websiteRoot, 'public', 'channels.json');
const owner = process.env.IPTV_GITHUB_OWNER || 'projectirbie-web';
const repo = process.env.IPTV_GITHUB_REPO || 'tv';
const branch = process.env.IPTV_GITHUB_BRANCH || 'main';
const streamsApi = `https://api.github.com/repos/${owner}/${repo}/contents/streams?ref=${encodeURIComponent(branch)}`;
const userAgent = 'ProjectIrbieTV-PlaylistSync/1.0';

function parseAttributes(text) {
  const attrs = {};
  const pattern = /([\w-]+)="([^"]*)"/g;
  for (const match of text.matchAll(pattern)) attrs[match[1].toLowerCase()] = match[2];
  return attrs;
}

function parseM3U(source, countryCode) {
  const rows = [];
  let current = null;

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      const comma = line.indexOf(',');
      const metadata = comma >= 0 ? line.slice(0, comma) : line;
      const name = comma >= 0 ? line.slice(comma + 1).trim() : 'Channel tanpa nama';
      current = {
        name: name || 'Channel tanpa nama',
        ...parseAttributes(metadata),
        countryCode: countryCode.toUpperCase(),
      };
      continue;
    }

    // EXTVLCOPT (Referer/User-Agent) is intentionally not applied: browser
    // JavaScript cannot override these headers on arbitrary third-party streams.
    if (line.startsWith('#')) continue;

    if (current && /^https?:\/\//i.test(line)) {
      const attrs = current;
      rows.push({
        id: `${attrs['tvg-id'] || attrs.name}-${countryCode}-${rows.length}`,
        name: attrs.name,
        url: line,
        logo: attrs['tvg-logo'] || '',
        tvgId: attrs['tvg-id'] || '',
        category: attrs['group-title'] || attrs.category || 'Umum',
        countryCode: attrs.countryCode,
      });
    }
    current = null;
  }

  return rows;
}

async function fetchWithTimeout(url, init = {}, timeoutMs = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { 'User-Agent': userAgent, ...(init.headers || {}) },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} saat mengambil ${url}`);
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function main() {
  console.log(`Mengambil daftar playlist dari ${owner}/${repo} (${branch})...`);
  const response = await fetchWithTimeout(streamsApi, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  const files = await response.json();
  if (!Array.isArray(files)) throw new Error('Respons GitHub tidak berisi daftar file streams/.');

  const playlistFiles = files.filter((file) => file.type === 'file' && /\.m3u8?$/i.test(file.name));
  if (playlistFiles.length === 0) throw new Error('Tidak menemukan file playlist .m3u/.m3u8 pada folder streams/.');
  console.log(`Menemukan ${playlistFiles.length} file playlist; mulai menggabungkan channel...`);

  let failedFiles = 0;
  const perFile = await mapLimit(playlistFiles, 8, async (file) => {
    const rawUrl = file.download_url || `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/streams/${encodeURIComponent(file.name)}`;
    try {
      const text = await (await fetchWithTimeout(rawUrl)).text();
      const countryCode = file.name.replace(/\.m3u8?$/i, '');
      return parseM3U(text, countryCode);
    } catch (error) {
      failedFiles += 1;
      console.warn(`Lewati ${file.name}: ${error.message}`);
      return [];
    }
  });

  const seen = new Set();
  const channels = [];
  for (const row of perFile.flat()) {
    const key = `${row.url}\n${row.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    channels.push(row);
  }
  channels.sort((a, b) => a.name.localeCompare(b.name, 'id'));

  await mkdir(path.dirname(outputFile), { recursive: true });
  await writeFile(outputFile, `${JSON.stringify({
    source: `https://github.com/${owner}/${repo}/tree/${branch}/streams`,
    generatedAt: new Date().toISOString(),
    count: channels.length,
    channels,
  }, null, 2)}\n`);

  if (channels.length === 0) throw new Error('Playlist berhasil diambil, tetapi tidak ada entri stream HTTP/HTTPS yang valid.');
  console.log(`Selesai: ${channels.length} entri channel disimpan ke public/channels.json.`);
  if (failedFiles) console.warn(`${failedFiles} file playlist gagal diambil dan dilewati.`);
  console.log('Catatan: entri yang ada belum otomatis berarti stream aktif atau boleh ditayangkan.');
}

main().catch(async (error) => {
  // If a previously generated playlist is available, permit offline development.
  try {
    const previous = await readFile(outputFile, 'utf8');
    const parsed = JSON.parse(previous);
    if (Array.isArray(parsed.channels) && parsed.channels.length) {
      console.warn(`Sinkronisasi gagal (${error.message}); memakai public/channels.json yang sudah ada (${parsed.channels.length} channel).`);
      process.exit(0);
    }
  } catch {
    // No cached playlist exists; report the actionable error below.
  }
  console.error('\nGagal mengambil playlist dari GitHub. Pastikan koneksi internet aktif dan repo/branch benar.');
  console.error(error.message);
  console.error('Jika repo bukan projectirbie-web/tv, set IPTV_GITHUB_OWNER, IPTV_GITHUB_REPO, atau IPTV_GITHUB_BRANCH.');
  process.exit(1);
});
