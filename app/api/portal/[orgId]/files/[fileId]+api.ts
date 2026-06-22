import { pool } from '@/lib/pool';
import { readUpload, deleteUpload } from '@/lib/files';

export async function GET(_request: Request, { orgId, fileId }: { orgId: string; fileId: string }) {
  if (!orgId || !fileId) return Response.json({ error: 'orgId and fileId required' }, { status: 400 });

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT "storageKey", "mimeType", "originalName" FROM "File"
       WHERE id = $1 AND "organizationId" = $2 AND "visibility" = 'CLIENT_VISIBLE'`,
      [fileId, orgId],
    );
    if (!result.rows[0]) return Response.json({ error: 'File not found' }, { status: 404 });

    const { storageKey, mimeType, originalName } = result.rows[0];
    const buffer = await readUpload(storageKey);
    if (!buffer) return Response.json({ error: 'File not found on disk' }, { status: 404 });

    const contentType = mimeType || 'application/octet-stream';
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${originalName}"`,
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    };
    // SVGs can embed scripts; when opened top-level they would execute on the
    // app origin. Sandbox the document so previews render but cannot run scripts.
    if (contentType.includes('svg')) {
      headers['Content-Security-Policy'] = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
    }
    return new Response(buffer, { headers });
  } finally {
    client.release();
  }
}

export async function PATCH(request: Request, { orgId, fileId }: { orgId: string; fileId: string }) {
  if (!orgId || !fileId) return Response.json({ error: 'orgId and fileId required' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const { originalName } = body;
  if (!originalName || !originalName.trim()) {
    return Response.json({ error: 'originalName required' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const check = await client.query(
      `SELECT id FROM "File" WHERE id = $1 AND "organizationId" = $2 AND "visibility" = 'CLIENT_VISIBLE'`,
      [fileId, orgId]
    );
    if (!check.rows[0]) return Response.json({ error: 'File not found' }, { status: 404 });

    await client.query(
      `UPDATE "File" SET "originalName" = $1 WHERE id = $2`,
      [originalName.trim(), fileId]
    );
    return Response.json({ success: true });
  } finally {
    client.release();
  }
}

export async function DELETE(_request: Request, { orgId, fileId }: { orgId: string; fileId: string }) {
  if (!orgId || !fileId) return Response.json({ error: 'orgId and fileId required' }, { status: 400 });

  const client = await pool.connect();
  try {
    const check = await client.query(
      `SELECT id, "storageKey" FROM "File" WHERE id = $1 AND "organizationId" = $2 AND "visibility" = 'CLIENT_VISIBLE'`,
      [fileId, orgId]
    );
    if (!check.rows[0]) {
      return Response.json({ error: 'File not found' }, { status: 404 });
    }
    const storageKey = check.rows[0].storageKey;
    await client.query(`DELETE FROM "File" WHERE id = $1`, [fileId]);
    await deleteUpload(storageKey);
    return Response.json({ ok: true });
  } finally {
    client.release();
  }
}
