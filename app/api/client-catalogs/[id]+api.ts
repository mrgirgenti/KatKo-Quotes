import { pool } from '@/lib/pool';

export async function PATCH(req: Request, { id }: { id: string }) {
  try {
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

    const body = await req.json();
    const {
      name, description, vendorName, category,
      catalogUrl, websiteUrl, coverImageUrl,
      logoColor, logoInitials,
      isActive, showInClientHub, isFeatured, sortOrder,
    } = body;

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (name !== undefined)            { updates.push(`name = $${idx++}`);                values.push(name); }
    if (description !== undefined)     { updates.push(`description = $${idx++}`);         values.push(description || null); }
    if (vendorName !== undefined)      { updates.push(`"vendorName" = $${idx++}`);        values.push(vendorName || null); }
    if (category !== undefined)        { updates.push(`category = $${idx++}`);            values.push(category); }
    if (catalogUrl !== undefined)      { updates.push(`"catalogUrl" = $${idx++}`);        values.push(catalogUrl || null); }
    if (websiteUrl !== undefined)      { updates.push(`"websiteUrl" = $${idx++}`);        values.push(websiteUrl || null); }
    if (coverImageUrl !== undefined)   { updates.push(`"coverImageUrl" = $${idx++}`);     values.push(coverImageUrl || null); }
    if (logoColor !== undefined)       { updates.push(`"logoColor" = $${idx++}`);         values.push(logoColor || null); }
    if (logoInitials !== undefined)    { updates.push(`"logoInitials" = $${idx++}`);      values.push(logoInitials || null); }
    if (isActive !== undefined)        { updates.push(`"isActive" = $${idx++}`);          values.push(isActive); }
    if (showInClientHub !== undefined) { updates.push(`"showInClientHub" = $${idx++}`);   values.push(showInClientHub); }
    if (isFeatured !== undefined)      { updates.push(`"isFeatured" = $${idx++}`);        values.push(isFeatured); }
    if (sortOrder !== undefined)       { updates.push(`"sortOrder" = $${idx++}`);         values.push(sortOrder); }

    if (updates.length === 0) {
      return Response.json({ error: 'No fields to update' }, { status: 400 });
    }

    updates.push(`"updatedAt" = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE "ClientCatalog" SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return Response.json({ error: 'Vendor not found' }, { status: 404 });
    }

    return Response.json(result.rows[0]);
  } catch (err) {
    console.error('[PATCH /api/client-catalogs/:id]', err);
    return Response.json({ error: 'Failed to update vendor' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { id }: { id: string }) {
  try {
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

    const result = await pool.query(`DELETE FROM "ClientCatalog" WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) {
      return Response.json({ error: 'Vendor not found' }, { status: 404 });
    }
    return Response.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/client-catalogs/:id]', err);
    return Response.json({ error: 'Failed to delete vendor' }, { status: 500 });
  }
}
