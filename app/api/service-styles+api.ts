import { pool } from '@/lib/pool';

export function rowToStyle(r: any) {
  return {
    id: r.id,
    name: r.name,
    supplier: r.supplier ?? undefined,
    defaultMargin: r.default_margin != null ? parseFloat(r.default_margin) : undefined,
    defaultProductionDays: r.default_production_days ?? undefined,
    defaultProductionCosts: Array.isArray(r.default_production_costs)
      ? r.default_production_costs
      : [],
    defaultArtworkRequirements: r.default_artwork_requirements ?? undefined,
    defaultTaxBehavior: r.default_tax_behavior ?? 'taxable',
    description: r.description ?? undefined,
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
      defaultProductionDays,
      defaultProductionCosts = [],
      defaultArtworkRequirements,
      defaultTaxBehavior = 'taxable',
      description,
      enabled = true,
      sortOrder = 0,
    } = body;

    if (!name) {
      return Response.json({ error: 'name is required' }, { status: 400 });
    }

    const { rows } = await pool.query(
      `INSERT INTO "ServiceStyle"
         (id, name, supplier, default_margin, default_production_days,
          default_production_costs, default_artwork_requirements, default_tax_behavior,
          description, enabled, sort_order, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, now(), now())
       RETURNING *`,
      [
        name,
        supplier ?? null,
        defaultMargin ?? null,
        defaultProductionDays ?? null,
        JSON.stringify(defaultProductionCosts),
        defaultArtworkRequirements ?? null,
        defaultTaxBehavior,
        description ?? null,
        enabled,
        sortOrder,
      ],
    );

    return Response.json(rowToStyle(rows[0]), { status: 201 });
  } catch (err: any) {
    console.error('[service-styles POST]', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
