import { pool } from '@/lib/pool';
import { readUpload, deleteUpload } from '@/lib/files';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
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
    const buffer = readUpload(file.storageKey);
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

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
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
    deleteUpload(file.storageKey);
    await client.query(`DELETE FROM "File" WHERE id = $1`, [id]);
    return Response.json({ success: true });
  } finally {
    client.release();
  }
}
