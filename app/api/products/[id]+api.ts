import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized } from '@/lib/auth';

export async function GET(request: Request, { id }: { id: string }) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();
  if (!id) return Response.json({ error: 'Not found' }, { status: 404 });

  const url = new URL(request.url);
  const include = url.searchParams.get('include') || '';

  const client = await pool.connect();
  try {
    const result = await client.query(`SELECT * FROM "Product" WHERE id = $1`, [id]);
    if (result.rows.length === 0) return Response.json({ error: 'Product not found' }, { status: 404 });

    const product = result.rows[0] as Record<string, unknown>;

    if (include.includes('colors')) {
      const colorRes = await client.query(
        `SELECT * FROM "ProductColor" WHERE "productId" = $1 ORDER BY "sortOrder" ASC, "colorName" ASC`,
        [id],
      );
      const colors = colorRes.rows as Array<Record<string, unknown>>;

      if (include.includes('assets') && colors.length > 0) {
        const colorIds = colors.map(c => c.id);
        const assetRes = await client.query(
          `SELECT * FROM "ProductAsset" WHERE "productColorId" = ANY($1::text[]) ORDER BY "sortOrder" ASC`,
          [colorIds],
        );
        const assetsByColor: Record<string, unknown[]> = {};
        for (const a of assetRes.rows) {
          if (!assetsByColor[a.productColorId]) assetsByColor[a.productColorId] = [];
          assetsByColor[a.productColorId].push(a);
        }
        for (const c of colors) {
          c.assets = assetsByColor[c.id as string] || [];
        }
      }

      product.colors = colors;
    }

    if (include.includes('placements')) {
      const placRes = await client.query(
        `SELECT * FROM "ProductPlacement" WHERE "productId" = $1 AND "isActive" = true ORDER BY side ASC, "placementType" ASC`,
        [id],
      );
      product.placements = placRes.rows;
    }

    return Response.json({ product });
  } catch (err) {
    console.error('[GET /api/products/:id]', err);
    return Response.json({ error: 'Failed to load product' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function PATCH(request: Request, { id }: { id: string }) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();
  if (!id) return Response.json({ error: 'Not found' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { styleNumber, vendor, brand, name, category, isActive, sortOrder, templateId,
          subcategory, productType, gender, defaultBlankCost, recommendationLevel, isLegacy } = body;

  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (styleNumber !== undefined)        { updates.push(`"styleNumber" = $${idx++}`);           values.push(styleNumber); }
  if (vendor !== undefined)             { updates.push(`vendor = $${idx++}`);                  values.push(vendor); }
  if (brand !== undefined)              { updates.push(`brand = $${idx++}`);                   values.push(brand); }
  if (name !== undefined)               { updates.push(`name = $${idx++}`);                    values.push(name); }
  if (category !== undefined)           { updates.push(`category = $${idx++}`);                values.push(category); }
  if (isActive !== undefined)           { updates.push(`"isActive" = $${idx++}`);              values.push(isActive); }
  if (sortOrder !== undefined)          { updates.push(`"sortOrder" = $${idx++}`);             values.push(sortOrder); }
  if ('templateId' in body)             { updates.push(`"templateId" = $${idx++}`);            values.push(templateId ?? null); }
  if ('subcategory' in body)            { updates.push(`subcategory = $${idx++}`);             values.push(subcategory ?? null); }
  if ('productType' in body)            { updates.push(`"productType" = $${idx++}`);           values.push(productType ?? null); }
  if ('gender' in body)                 { updates.push(`gender = $${idx++}`);                  values.push(gender ?? null); }
  if ('recommendationLevel' in body)    { updates.push(`"recommendationLevel" = $${idx++}`);   values.push(recommendationLevel ?? null); }
  if ('isLegacy' in body)               { updates.push(`"isLegacy" = $${idx++}`);              values.push(!!isLegacy); }
  if ('defaultBlankCost' in body) {
    const costVal = defaultBlankCost !== null && defaultBlankCost !== undefined
      ? parseFloat(String(defaultBlankCost))
      : null;
    updates.push(`"defaultBlankCost" = $${idx++}`);
    values.push(isNaN(costVal as number) ? null : costVal);
    updates.push(`"lastCostUpdatedAt" = NOW()`);
  }

  if (updates.length === 0) return Response.json({ error: 'No fields to update' }, { status: 400 });

  updates.push(`"updatedAt" = NOW()`);
  values.push(id);

  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE "Product" SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );
    if (result.rows.length === 0) return Response.json({ error: 'Product not found' }, { status: 404 });
    return Response.json({ product: result.rows[0] });
  } catch (err: unknown) {
    const pg = err as { code?: string };
    if (pg?.code === '23505') {
      return Response.json({ error: 'Style number already exists' }, { status: 409 });
    }
    console.error('[PATCH /api/products/:id]', err);
    return Response.json({ error: 'Failed to update product' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(request: Request, { id }: { id: string }) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();
  if (!id) return Response.json({ error: 'Not found' }, { status: 404 });

  const client = await pool.connect();
  try {
    const result = await client.query(
      `DELETE FROM "Product" WHERE id = $1 RETURNING id`,
      [id],
    );
    if (result.rows.length === 0) return Response.json({ error: 'Product not found' }, { status: 404 });
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/products/:id]', err);
    return Response.json({ error: 'Failed to delete product' }, { status: 500 });
  } finally {
    client.release();
  }
}
