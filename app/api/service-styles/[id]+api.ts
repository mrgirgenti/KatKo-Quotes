import { pool } from '@/lib/pool';

function rowToStyle(r: any) {
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
      supplier: 'supplier',
      defaultMargin: 'default_margin',
      quantityMode: 'quantity_mode',
      enabled: 'enabled',
      sortOrder: 'sort_order',
    };

    for (const [jsKey, dbCol] of Object.entries(allowed)) {
      if (jsKey in body) {
        fields.push(`${dbCol} = $${idx++}`);
        values.push(body[jsKey] ?? null);
      }
    }

    if (fields.length === 0) return Response.json({ error: 'No fields to update' }, { status: 400 });

    fields.push(`updated_at = now()`);
    values.push(id);

    const { rows } = await pool.query(
      `UPDATE "ServiceStyle" SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );

    if (rows.length === 0) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(rowToStyle(rows[0]));
  } catch (err: any) {
    console.error('[service-styles PATCH]', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } | null }) {
  const id = (params ?? {}).id;
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

  try {
    const { rowCount } = await pool.query(`DELETE FROM "ServiceStyle" WHERE id = $1`, [id]);
    if ((rowCount ?? 0) === 0) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ ok: true });
  } catch (err: any) {
    console.error('[service-styles DELETE]', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
