import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
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
        requiresReferrer: false,
        requiresUserAgent: false,
      };
      continue;
    }

    // Preserve the fact that the source asks for headers. A browser player cannot
    // freely override Referer/User-Agent for arbitrary third-party origins, so the
    // player can prefer a compatible HTTPS mirror rather than silently pretending.
    if (line.startsWith('#EXTVLCOPT:') && current) {
      if (/http-referrer\s*=/i.test(line)) current.requiresReferrer = true;
      if (/http-user-agent\s*=/i.test(line)) current.requiresUserAgent = true;
      continue;
    }
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
        requiresReferrer: Boolean(attrs.requiresReferrer),
        requiresUserAgent: Boolean(attrs.requiresUserAgent),
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
  const streamsDir = path.resolve(websiteRoot, '..', 'streams');
  let localFiles = [];
  try {
    localFiles = (await readdir(streamsDir, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && /\.m3u8?$/i.test(entry.name))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    // A hosted build may not expose files outside the Website root.
  }

  let failedFiles = 0;
  let sourceFileCount = localFiles.length;
  let perFile;
  if (localFiles.length) {
    console.log(`Membaca ${localFiles.length} playlist lokal dari ${streamsDir}...`);
    perFile = await mapLimit(localFiles, 12, async (fileName) => {
      try {
        const rawText = await readFile(path.join(streamsDir, fileName), 'utf8');
        const countryCode = fileName.replace(/\.m3u8?$/i, '').split('_')[0];
        return parseM3U(rawText, countryCode);
      } catch (error) {
        failedFiles += 1;
        console.warn(`Lewati ${fileName}: ${error.message}`);
        return [];
      }
    });
  } else {
    console.log(`Playlist lokal tidak tersedia; mengambil daftar dari ${owner}/${repo} (${branch})...`);
    // GitHub's contents endpoint returns at most 30 entries by default. Explicit
    // pagination is required so deployments can see the full streams/ directory.
    const remoteFiles = [];
    for (let page = 1; ; page += 1) {
      const pageUrl = `${streamsApi}&per_page=100&page=${page}`;
      const response = await fetchWithTimeout(pageUrl, {
        headers: { Accept: 'application/vnd.github+json' },
      });
      const pageFiles = await response.json();
      if (!Array.isArray(pageFiles)) throw new Error('Respons GitHub tidak berisi daftar file streams/.');
      remoteFiles.push(...pageFiles.filter((file) => file.type === 'file' && /\.m3u8?$/i.test(file.name)));
      if (pageFiles.length < 100) break;
    }
    const playlistFiles = remoteFiles;
    sourceFileCount = playlistFiles.length;
    if (!playlistFiles.length) throw new Error('Tidak menemukan playlist .m3u/.m3u8 pada folder streams/.');
    console.log(`Menemukan ${playlistFiles.length} playlist; mulai menggabungkan channel...`);
    perFile = await mapLimit(playlistFiles, 8, async (file) => {
      try {
        const rawUrl = file.download_url || `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/streams/${encodeURIComponent(file.name)}`;
        const rawText = await (await fetchWithTimeout(rawUrl)).text();
        const countryCode = file.name.replace(/\.m3u8?$/i, '').split('_')[0];
        return parseM3U(rawText, countryCode);
      } catch (error) {
        failedFiles += 1;
        console.warn(`Lewati ${file.name}: ${error.message}`);
        return [];
      }
    });
  }

  // Tambahkan sumber resmi berupa embed yang memang disediakan
  // untuk ditampilkan di dalam situs lain.
  const officialFile = path.join(websiteRoot, 'data', 'official-channels.json');
  let officialChannels = [];

  try {
    const parsed = JSON.parse(await readFile(officialFile, 'utf8'));
    if (!Array.isArray(parsed)) {
      throw new Error('official-channels.json harus berupa array.');
    }

    officialChannels = parsed.map((row, index) => {
      if (!row?.id || !row?.name ||
          !/^https:\/\//i.test(row.url || '') ||
          !['embed', 'official-link'].includes(row.playerType)) {
        throw new Error(`Entri sumber resmi ke-${index + 1} tidak valid.`);
      }

      return {
        ...row,
        countryCode: String(row.countryCode || 'ID').toUpperCase(),
        category: row.category || 'Resmi',
        logo: row.logo || '',
        tvgId: row.tvgId || row.id,
        requiresReferrer: Boolean(row.requiresReferrer),
        requiresUserAgent: Boolean(row.requiresUserAgent),
      };
    });

    console.log(`Membaca ${officialChannels.length} sumber resmi (embed/halaman).`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    console.log('Katalog embed resmi belum dibuat; hanya menggunakan playlist.');
  }

  const seen = new Set();
  const channels = [];
  for (const row of [...perFile.flat(), ...officialChannels]) {
    const key = `${row.url}\n${row.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    channels.push({ ...row, playerType: row.playerType || 'hls' });
  }
  const countryPriority = ['id', 'my', 'th', 'kr', 'jp', 'sa', 'ae', 'qa', 'kw', 'bh', 'om', 'ye', 'jo', 'iq', 'lb', 'ps', 'il', 'us', 'gb', 'uk', 'ca', 'au', 'nz', 'fr', 'de', 'es', 'it'];
  const priorityIndex = (code) => {
    const index = countryPriority.indexOf(String(code || '').toLowerCase());
    return index === -1 ? countryPriority.length : index;
  };
  channels.sort((a, b) => priorityIndex(a.countryCode) - priorityIndex(b.countryCode)
    || a.name.localeCompare(b.name, 'id'));

  await mkdir(path.dirname(outputFile), { recursive: true });
  await writeFile(outputFile, `${JSON.stringify({
    source: `https://github.com/${owner}/${repo}/tree/${branch}/streams`,
    generatedAt: new Date().toISOString(),
    sourceFileCount,
    officialChannelCount: officialChannels.length,
    count: channels.length,
    channels,
  })}\n`);

  if (channels.length === 0) throw new Error('Playlist ditemukan, tetapi tidak ada entri stream HTTP/HTTPS yang valid.');
  console.log(`Selesai: ${channels.length} entri channel disimpan ke public/channels.json.`);
  if (failedFiles) console.warn(`${failedFiles} file playlist gagal dibaca dan dilewati.`);
  console.log('Catatan: entri channel tidak otomatis berarti stream aktif atau diizinkan untuk ditayangkan.');
}
main().catch((error) => {
  console.error('Gagal membuat katalog channel:', error.message);
  process.exit(1);
});
