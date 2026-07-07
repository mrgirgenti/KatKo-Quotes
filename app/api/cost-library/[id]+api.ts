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

export async function PATCH(request: Request, { params }: { params: { id: string } | null }) {
  const id = (params ?? {}).id;
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

  try {
    const body = await request.json();
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    const allowed: Record<string, string> = {
      name: 'name',
      category: 'category',
      calcType: 'calc_type',
      defaultRate: 'default_rate',
      appliesTo: 'applies_to',
      scope: 'scope',
      enabled: 'enabled',
      associatedService: 'associated_service',
      notes: 'notes',
      sortOrder: 'sort_order',
    };

    for (const [jsKey, dbCol] of Object.entries(allowed)) {
      if (jsKey in body) {
        fields.push(`${dbCol} = $${idx++}`);
        values.push(body[jsKey] ?? null);
      }
    }

    if (fields.length === 0) {
      return Response.json({ error: 'No fields to update' }, { status: 400 });
    }

    fields.push(`updated_at = now()`);
    values.push(id);

    const { rows } = await pool.query(
      `UPDATE "CostEntry" SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );

    if (rows.length === 0) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(rowToEntry(rows[0]));
  } catch (err: any) {
    console.error('[cost-library PATCH]', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } | null }) {
  const id = (params ?? {}).id;
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

  try {
    const { rowCount } = await pool.query(`DELETE FROM "CostEntry" WHERE id = $1`, [id]);
    if ((rowCount ?? 0) === 0) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ ok: true });
  } catch (err: any) {
    console.error('[cost-library DELETE]', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
