import { pool } from '@/lib/pool';

export async function GET(_request: Request, { orgId }: { orgId: string }) {
  if (!orgId) return Response.json({ error: 'orgId required' }, { status: 400 });

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, "organizationId", "projectId", "uploadedByUserId", "fileType",
              "originalName", "storageKey", "mimeType", "fileSize", "visibility", "createdAt"
       FROM "File"
       WHERE "organizationId" = $1
         AND "projectId" IS NULL
       ORDER BY "createdAt" DESC`,
      [orgId],
    );
    return Response.json({ files: result.rows });
  } finally {
    client.release();
  }
}
