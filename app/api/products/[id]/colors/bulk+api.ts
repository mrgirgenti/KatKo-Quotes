import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized } from '@/lib/auth';
import { deleteUpload } from '@/lib/files';

export async function POST(request: Request, { id }: { id: string }) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();
  if (!id) return Response.json({ error: 'Not found' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action } = body as { action?: string };

  const client = await pool.connect();
  try {
    const productCheck = await client.query(`SELECT id FROM "Product" WHERE id = $1`, [id]);
    if (productCheck.rows.length === 0) return Response.json({ error: 'Product not found' }, { status: 404 });

    // ── copy-from ─────────────────────────────────────────────────────────────
    if (action === 'copy-from') {
      const { sourceProductId } = body as { sourceProductId?: string };
      if (!sourceProductId?.trim()) {
        return Response.json({ error: 'sourceProductId required' }, { status: 400 });
      }

      const srcColors = await client.query(
        `SELECT * FROM "ProductColor"
         WHERE "productId" = $1 AND "isActive" = true
         ORDER BY "sortOrder" ASC, "colorName" ASC`,
        [sourceProductId],
      );

      if (srcColors.rows.length === 0) return Response.json({ copied: 0, skipped: 0 });

      const existing = await client.query(
        `SELECT "colorCode" FROM "ProductColor" WHERE "productId" = $1`,
        [id],
      );
      const existingCodes = new Set<string>(existing.rows.map((r: { colorCode: string }) => r.colorCode));

      const maxOrd = await client.query(
        `SELECT COALESCE(MAX("sortOrder"), -1) AS max FROM "ProductColor" WHERE "productId" = $1`,
        [id],
      );
      let nextOrder: number = (maxOrd.rows[0]?.max ?? -1) + 1;

      let copied = 0;
      let skipped = 0;
      for (const color of srcColors.rows) {
        if (existingCodes.has(color.colorCode)) { skipped++; continue; }
        await client.query(
          `INSERT INTO "ProductColor"
             (id, "productId", "colorCode", "colorName", hex, "catalogColorCode", notes, "isActive", "sortOrder", "createdAt", "updatedAt")
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, true, $7, NOW(), NOW())`,
          [id, color.colorCode, color.colorName, color.hex, color.catalogColorCode, color.notes, nextOrder++],
        );
        copied++;
      }
      return Response.json({ copied, skipped });
    }

    // ── clear ─────────────────────────────────────────────────────────────────
    if (action === 'clear') {
      const assets = await client.query(
        `SELECT pa."storageKey"
         FROM "ProductAsset" pa
         JOIN "ProductColor" pc ON pa."productColorId" = pc.id
         WHERE pc."productId" = $1`,
        [id],
      );

      const result = await client.query(
        `DELETE FROM "ProductColor" WHERE "productId" = $1 RETURNING id`,
        [id],
      );

      for (const row of assets.rows) {
        deleteUpload(row.storageKey).catch((err: unknown) =>
          console.error('[bulk clear] storage cleanup failed for', row.storageKey, err),
        );
      }

      return Response.json({ deleted: result.rows.length });
    }

    // ── import ────────────────────────────────────────────────────────────────
    if (action === 'import') {
      const { lines } = body as { lines?: string };
      if (!lines?.trim()) return Response.json({ error: 'lines required' }, { status: 400 });

      const maxOrd = await client.query(
        `SELECT COALESCE(MAX("sortOrder"), -1) AS max FROM "ProductColor" WHERE "productId" = $1`,
        [id],
      );
      let nextOrder: number = (maxOrd.rows[0]?.max ?? -1) + 1;

      const parsed: Array<{ colorCode: string; colorName: string; hex: string | null }> = [];
      for (const rawLine of lines.split('\n')) {
        const line = rawLine.trim();
        if (!line) continue;

        let parts: string[];
        if (line.includes('|')) {
          parts = line.split('|').map(p => p.trim());
        } else if (line.includes('\t')) {
          parts = line.split('\t').map(p => p.trim());
        } else if ((line.match(/,/g) || []).length >= 1) {
          parts = line.split(',').map(p => p.trim());
        } else {
          parts = line.split(/\s{2,}/).map(p => p.trim());
          if (parts.length < 2) {
            const hexMatch = line.match(/#[0-9a-fA-F]{3,6}/);
            const name = line.replace(/#[0-9a-fA-F]{3,6}/, '').trim();
            parts = [name, name, hexMatch?.[0] ?? ''];
          }
        }

        const colorCode = parts[0]?.trim() || '';
        if (!colorCode) continue;
        const colorName = parts[1]?.trim() || colorCode;
        const hexRaw = parts[2]?.trim() || '';
        const hex = /^#?[0-9a-fA-F]{3,6}$/.test(hexRaw)
          ? (hexRaw.startsWith('#') ? hexRaw : `#${hexRaw}`)
          : null;

        parsed.push({ colorCode, colorName, hex });
      }

      if (parsed.length === 0) {
        return Response.json({ error: 'No valid colors found', imported: 0 }, { status: 400 });
      }

      const existing = await client.query(
        `SELECT "colorCode" FROM "ProductColor" WHERE "productId" = $1`,
        [id],
      );
      const existingCodes = new Set<string>(existing.rows.map((r: { colorCode: string }) => r.colorCode));

      let imported = 0;
      let skipped = 0;
      for (const c of parsed) {
        if (existingCodes.has(c.colorCode)) { skipped++; continue; }
        await client.query(
          `INSERT INTO "ProductColor"
             (id, "productId", "colorCode", "colorName", hex, "isActive", "sortOrder", "createdAt", "updatedAt")
           VALUES (gen_random_uuid(), $1, $2, $3, $4, true, $5, NOW(), NOW())`,
          [id, c.colorCode, c.colorName, c.hex, nextOrder++],
        );
        imported++;
      }
      return Response.json({ imported, skipped });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error('[POST /api/products/:id/colors/bulk]', err);
    return Response.json({ error: 'Bulk operation failed' }, { status: 500 });
  } finally {
    client.release();
  }
}
