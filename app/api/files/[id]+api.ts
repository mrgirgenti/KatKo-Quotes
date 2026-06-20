import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized } from '@/lib/auth';
import { readUpload, deleteUpload } from '@/lib/files';

export async function GET(request: Request, { id }: { id: string }) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();

  if (!id) return new Response('Not found', { status: 404 });
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT * FROM "File" WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return new Response('Not found', { status: 404 });
    }
    const file = result.rows[0];
    const buffer = await readUpload(file.storageKey);
    if (!buffer) {
      return new Response('File not found on server', { status: 404 });
    }
    const url = new URL(request.url);
    const inline = url.searchParams.get('inline') === 'true';
    const disposition = inline ? 'inline' : `attachment; filename="${file.originalName}"`;
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': file.mimeType || 'application/octet-stream',
        'Content-Disposition': disposition,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } finally {
    client.release();
  }
}

export async function PATCH(request: Request, { id }: { id: string }) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();

  if (!id) return Response.json({ error: 'Not found' }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const { projectId, originalName } = body;

  if (!projectId && !originalName) {
    return Response.json({ error: 'projectId or originalName required' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    if (originalName) {
      await client.query(
        `UPDATE "File" SET "originalName" = $1 WHERE id = $2`,
        [originalName.trim(), id]
      );
    } else if (projectId) {
      await client.query(
        `UPDATE "File" SET "projectId" = $1 WHERE id = $2`,
        [projectId, id]
      );
    }
    return Response.json({ success: true });
  } finally {
    client.release();
  }
}

export async function DELETE(request: Request, { id }: { id: string }) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();

  if (!id) return Response.json({ error: 'Not found' }, { status: 404 });
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT * FROM "File" WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }
    const file = result.rows[0];
    await deleteUpload(file.storageKey);
    await client.query(`DELETE FROM "File" WHERE id = $1`, [id]);
    return Response.json({ success: true });
  } finally {
    client.release();
  }
}
