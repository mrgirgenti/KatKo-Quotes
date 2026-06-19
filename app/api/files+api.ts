import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized } from '@/lib/auth';
import { writeUpload, ALLOWED_MIME_TYPES } from '@/lib/files';

export async function GET(request: Request) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();

  const url = new URL(request.url);
  const orgId = url.searchParams.get('orgId');
  const projectId = url.searchParams.get('projectId');
  const scope = url.searchParams.get('scope');

  if (!orgId) return Response.json({ error: 'orgId required' }, { status: 400 });

  const client = await pool.connect();
  try {
    let query: string;
    let params: (string | null)[];

    if (scope === 'org') {
      query = `
        SELECT f.*, u."firstName", u."lastName"
        FROM "File" f
        LEFT JOIN "User" u ON u.id = f."uploadedByUserId"
        WHERE f."organizationId" = $1 AND f."projectId" IS NULL
        ORDER BY f."createdAt" DESC
      `;
      params = [orgId];
    } else if (projectId) {
      query = `
        SELECT f.*, u."firstName", u."lastName"
        FROM "File" f
        LEFT JOIN "User" u ON u.id = f."uploadedByUserId"
        WHERE f."organizationId" = $1 AND f."projectId" = $2
        ORDER BY f."createdAt" DESC
      `;
      params = [orgId, projectId];
    } else {
      query = `
        SELECT f.*, u."firstName", u."lastName"
        FROM "File" f
        LEFT JOIN "User" u ON u.id = f."uploadedByUserId"
        WHERE f."organizationId" = $1
        ORDER BY f."createdAt" DESC
      `;
      params = [orgId];
    }

    const result = await client.query(query, params);
    return Response.json({ files: result.rows });
  } finally {
    client.release();
  }
}

export async function POST(request: Request) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const fileEntry = formData.get('file') as File | null;
  const orgId = formData.get('orgId') as string | null;
  const projectId = formData.get('projectId') as string | null;
  const uploadedByUserId = formData.get('uploadedByUserId') as string | null;
  const fileTypeParam = (formData.get('fileType') as string | null) || 'ARTWORK';
  const visibility = (formData.get('visibility') as string | null) || 'CLIENT_VISIBLE';

  if (!fileEntry || !orgId) {
    return Response.json({ error: 'file and orgId are required' }, { status: 400 });
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
       VALUES (gen_random_uuid(), $1, $2, $3, $4::\"FileType\", $5, $6, $7, $8, $9::\"FileVisibility\", now())
       RETURNING *`,
      [orgId, projectId || null, uploadedByUserId || null, fileTypeParam, fileEntry.name, storageKey, mimeType, buffer.length, visibility]
    );
    if (projectId && fileTypeParam === 'ARTWORK') {
      await client.query(
        `UPDATE "Project" SET "artworkReceived" = true WHERE id = $1 AND "artworkReceived" = false`,
        [projectId],
      ).catch((err) => console.error('[POST /api/files] artworkReceived auto-set failed:', err));
    }
    return Response.json({ file: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
