import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const file = path.join(process.cwd(), 'public', 'channels.json');
    const raw = await readFile(file, 'utf8');
    const catalog = JSON.parse(raw);
    const count = Array.isArray(catalog) ? catalog.length : catalog.count ?? catalog.channels?.length ?? 0;
    if (!count) {
      return Response.json({ ok: false, service: 'yegtv', error: 'Katalog tersedia tetapi tidak berisi channel.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
    return Response.json({
      ok: true,
      service: 'yegtv',
      runtime: 'nextjs-node',
      catalogCount: count,
      playlistFiles: catalog.sourceFileCount ?? null,
      generatedAt: catalog.generatedAt ?? null,
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch {
    return Response.json({ ok: false, service: 'yegtv', error: 'Katalog belum dibuat. Pastikan tahap sync:channels berhasil pada build.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
