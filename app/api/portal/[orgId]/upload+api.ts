import { pool } from '@/lib/pool';
import { writeUpload, ALLOWED_MIME_TYPES } from '@/lib/files';

export async function POST(request: Request, { orgId }: { orgId: string }) {
  if (!orgId) return Response.json({ error: 'orgId required' }, { status: 400 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const fileEntry = formData.get('file') as File | null;
  const uploadedByUserId = formData.get('uploadedByUserId') as string | null;
  const fileTypeParam = (formData.get('fileType') as string | null) || 'ARTWORK';
  const visibility = (formData.get('visibility') as string | null) || 'CLIENT_VISIBLE';

  if (!fileEntry) {
    return Response.json({ error: 'file is required' }, { status: 400 });
  }

  const mimeType = fileEntry.type || 'application/octet-stream';
  if (!ALLOWED_MIME_TYPES[mimeType]) {
    const name = fileEntry.name.toLowerCase();
    const isAllowedExt = name.endsWith('.ai') || name.endsWith('.svg') || name.endsWith('.ps')
      || name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg')
      || name.endsWith('.pdf') || name.endsWith('.emb') || name.endsWith('.dst') || name.endsWith('.pes');
    if (!isAllowedExt) {
      return Response.json({ error: 'File type not allowed. Supported: AI, SVG, PS, PNG, JPG, PDF, EMB, DST, PES.' }, { status: 400 });
    }
  }

  const buffer = Buffer.from(await fileEntry.arrayBuffer());
  const storageKey = writeUpload(orgId, fileEntry.name, buffer);

  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO "File" (id, "organizationId", "projectId", "uploadedByUserId", "fileType", "originalName", "storageKey", "mimeType", "fileSize", "visibility", "createdAt")
       VALUES (gen_random_uuid(), $1, NULL, $2, $3::"FileType", $4, $5, $6, $7, $8::"FileVisibility", now())
       RETURNING *`,
      [orgId, uploadedByUserId || null, fileTypeParam, fileEntry.name, storageKey, mimeType, buffer.length, visibility]
    );
    return Response.json({ file: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
