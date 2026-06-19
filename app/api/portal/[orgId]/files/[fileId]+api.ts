import { pool } from '@/lib/pool';
import { deleteUpload } from '@/lib/files';

export async function DELETE(_request: Request, { orgId, fileId }: { orgId: string; fileId: string }) {
  if (!orgId || !fileId) return Response.json({ error: 'orgId and fileId required' }, { status: 400 });

  const client = await pool.connect();
  try {
    const check = await client.query(
      `SELECT id, "storageKey" FROM "File" WHERE id = $1 AND "organizationId" = $2`,
      [fileId, orgId]
    );
    if (!check.rows[0]) {
      return Response.json({ error: 'File not found' }, { status: 404 });
    }
    const storageKey = check.rows[0].storageKey;
    await client.query(`DELETE FROM "File" WHERE id = $1`, [fileId]);
    deleteUpload(storageKey);
    return Response.json({ ok: true });
  } finally {
    client.release();
  }
}
