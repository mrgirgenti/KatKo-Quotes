import { pool } from '@/lib/pool';

function rowToEntry(r: any) {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    calcType: r.calc_type,
    defaultRate: r.default_rate ?? '0',
    appliesTo: r.applies_to ?? '',
    scope: r.scope ?? '',
    enabled: r.enabled,
    associatedService: r.associated_service ?? '',
    notes: r.notes ?? '',
    sortOrder: r.sort_order ?? 0,
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');

    const { rows } = await pool.query(
      `SELECT * FROM "CostEntry"
       ${category ? 'WHERE category = $1' : ''}
       ORDER BY sort_order ASC, created_at ASC`,
      category ? [category] : [],
    );

    return Response.json(rows.map(rowToEntry));
  } catch (err: any) {
    console.error('[cost-library GET]', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      name,
      category,
      calcType = 'flat',
      defaultRate = '0',
      appliesTo,
      scope,
      enabled = true,
      associatedService,
      notes,
      sortOrder = 0,
    } = body;

    if (!name || !category) {
      return Response.json({ error: 'name and category are required' }, { status: 400 });
    }

    const { rows } = await pool.query(
      `INSERT INTO "CostEntry"
         (id, name, category, calc_type, default_rate, applies_to, scope,
          enabled, associated_service, notes, sort_order, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now())
       RETURNING *`,
      [name, category, calcType, defaultRate, appliesTo ?? null, scope ?? null,
       enabled, associatedService ?? null, notes ?? null, sortOrder],
    );

    return Response.json(rowToEntry(rows[0]), { status: 201 });
  } catch (err: any) {
    console.error('[cost-library POST]', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
