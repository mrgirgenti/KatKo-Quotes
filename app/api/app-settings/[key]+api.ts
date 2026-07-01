import { pool } from '@/lib/pool';

export async function GET(_request: Request, { params }: { params: { key: string } | null }) {
  const key = (params ?? {}).key;
  if (!key) return Response.json({ error: 'Missing key' }, { status: 400 });

  try {
    const { rows } = await pool.query(
      `SELECT value FROM "AppSettings" WHERE key = $1`,
      [key],
    );
    if (rows.length === 0) return Response.json(null);
    return Response.json(rows[0].value);
  } catch (err: any) {
    console.error('[app-settings GET]', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { key: string } | null }) {
  const key = (params ?? {}).key;
  if (!key) return Response.json({ error: 'Missing key' }, { status: 400 });

  try {
    const value = await request.json();

    const { rows } = await pool.query(
      `INSERT INTO "AppSettings" (key, value, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
       RETURNING value`,
      [key, JSON.stringify(value)],
    );

    return Response.json(rows[0].value);
  } catch (err: any) {
    console.error('[app-settings PATCH]', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
