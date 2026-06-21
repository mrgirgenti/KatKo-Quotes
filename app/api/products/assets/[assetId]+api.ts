import { pool } from '@/lib/pool';
import { readUpload } from '@/lib/files';

function mimeFromKey(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

export async function GET(_request: Request, { assetId }: { assetId: string }) {
  if (!assetId) return new Response('Not found', { status: 404 });

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT "storageKey" FROM "ProductAsset" WHERE id = $1::uuid`,
      [assetId],
    );
    if (result.rows.length === 0) return new Response('Not found', { status: 404 });

    const { storageKey } = result.rows[0];
    const buffer = await readUpload(storageKey);
    if (!buffer) return new Response('File not found in storage', { status: 404 });

    return new Response(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': mimeFromKey(storageKey),
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err) {
    console.error('[GET /api/products/assets/:assetId]', err);
    return new Response('Server error', { status: 500 });
  } finally {
    client.release();
  }
}
