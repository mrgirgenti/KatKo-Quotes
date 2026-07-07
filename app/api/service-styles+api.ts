import { pool } from '@/lib/pool';

export function rowToStyle(r: any) {
  return {
    id: r.id,
    name: r.name,
    supplier: r.supplier ?? '',
    defaultMargin: r.default_margin ?? '',
    quantityMode: r.quantity_mode ?? '',
    enabled: r.enabled,
    sortOrder: r.sort_order ?? 0,
  };
}

export async function GET() {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM "ServiceStyle" ORDER BY sort_order ASC, name ASC`,
    );
    return Response.json(rows.map(rowToStyle));
  } catch (err: any) {
    console.error('[service-styles GET]', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      name,
      supplier,
      defaultMargin,
      quantityMode,
      enabled = true,
      sortOrder = 0,
    } = body;

    if (!name) {
      return Response.json({ error: 'name is required' }, { status: 400 });
    }

    const { rows } = await pool.query(
      `INSERT INTO "ServiceStyle"
         (id, name, supplier, default_margin, quantity_mode, enabled, sort_order, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, now(), now())
       RETURNING *`,
      [name, supplier ?? null, defaultMargin ?? null, quantityMode ?? null, enabled, sortOrder],
    );

    return Response.json(rowToStyle(rows[0]), { status: 201 });
  } catch (err: any) {
    console.error('[service-styles POST]', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
