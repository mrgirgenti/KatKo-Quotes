import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized } from '@/lib/auth';

export async function GET(request: Request) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();

  const url = new URL(request.url);
  const active = url.searchParams.get('active');
  const brand = url.searchParams.get('brand');
  const vendor = url.searchParams.get('vendor');
  const category = url.searchParams.get('category');
  const q = url.searchParams.get('q');
  const include = url.searchParams.get('include') || '';

  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (active !== 'false') {
    conditions.push(`p."isActive" = true`);
  }
  if (brand) {
    conditions.push(`p.brand ILIKE $${idx++}`);
    values.push(`%${brand}%`);
  }
  if (vendor) {
    conditions.push(`p.vendor ILIKE $${idx++}`);
    values.push(`%${vendor}%`);
  }
  if (category) {
    conditions.push(`p.category ILIKE $${idx++}`);
    values.push(`%${category}%`);
  }
  if (q) {
    conditions.push(`(p."styleNumber" ILIKE $${idx} OR p.name ILIKE $${idx} OR p.brand ILIKE $${idx})`);
    values.push(`%${q}%`);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT p.*,
          COALESCE(vc.cnt, 0)::int            AS "vendorCount",
          pv_pref.vendor_name                 AS "preferredVendorName",
          COALESCE(color_ct.cnt, 0)::int      AS "colorCount",
          COALESCE(asset_ct.cnt, 0)::int      AS "assetCount",
          COALESCE(placement_ct.cnt, 0)::int  AS "placementCount"
       FROM "Product" p
       LEFT JOIN (
         SELECT "productId", COUNT(*)::int AS cnt
         FROM "ProductVendor" WHERE "isActive" = true GROUP BY "productId"
       ) vc ON vc."productId" = p.id
       LEFT JOIN (
         SELECT pv."productId", v.name AS vendor_name
         FROM "ProductVendor" pv
         JOIN "Vendor" v ON v.id = pv."vendorId"
         WHERE pv."isPreferred" = true AND pv."isActive" = true
       ) pv_pref ON pv_pref."productId" = p.id
       LEFT JOIN (
         SELECT "productId", COUNT(*)::int AS cnt
         FROM "ProductColor" WHERE "isActive" = true GROUP BY "productId"
       ) color_ct ON color_ct."productId" = p.id
       LEFT JOIN (
         SELECT pc."productId", COUNT(pa.id)::int AS cnt
         FROM "ProductColor" pc
         JOIN "ProductAsset" pa ON pa."productColorId" = pc.id
         GROUP BY pc."productId"
       ) asset_ct ON asset_ct."productId" = p.id
       LEFT JOIN (
         SELECT "productId", COUNT(*)::int AS cnt
         FROM "ProductPlacement" WHERE "isActive" = true GROUP BY "productId"
       ) placement_ct ON placement_ct."productId" = p.id
       ${where} ORDER BY p."sortOrder" ASC, p.brand ASC, p.name ASC`,
      values,
    );

    const products = result.rows;

    if (include.includes('colors')) {
      const ids = products.map((p: { id: string }) => p.id);
      if (ids.length > 0) {
        const colorRes = await client.query(
          `SELECT c.* FROM "ProductColor" c WHERE c."productId" = ANY($1::text[]) AND c."isActive" = true ORDER BY c."sortOrder" ASC, c."colorName" ASC`,
          [ids],
        );
        const colorsByProduct: Record<string, unknown[]> = {};
        for (const c of colorRes.rows) {
          if (!colorsByProduct[c.productId]) colorsByProduct[c.productId] = [];
          colorsByProduct[c.productId].push(c);
        }

        if (include.includes('assets')) {
          const colorIds = colorRes.rows.map((c: { id: string }) => c.id);
          if (colorIds.length > 0) {
            const assetRes = await client.query(
              `SELECT a.* FROM "ProductAsset" a WHERE a."productColorId" = ANY($1::text[]) ORDER BY a."sortOrder" ASC`,
              [colorIds],
            );
            const assetsByColor: Record<string, unknown[]> = {};
            for (const a of assetRes.rows) {
              if (!assetsByColor[a.productColorId]) assetsByColor[a.productColorId] = [];
              assetsByColor[a.productColorId].push(a);
            }
            for (const c of colorRes.rows) {
              (c as Record<string, unknown>).assets = assetsByColor[c.id] || [];
            }
          }
        }

        for (const p of products) {
          (p as Record<string, unknown>).colors = colorsByProduct[p.id] || [];
        }
      }
    }

    return Response.json({ products });
  } catch (err) {
    console.error('[GET /api/products]', err);
    return Response.json({ error: 'Failed to load products' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(request: Request) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { styleNumber, vendor, brand, name, category, sortOrder, subcategory, productType, gender } = body as Record<string, string>;

  if (!styleNumber?.trim()) return Response.json({ error: 'styleNumber is required' }, { status: 400 });
  if (!vendor?.trim())      return Response.json({ error: 'vendor is required' }, { status: 400 });
  if (!brand?.trim())       return Response.json({ error: 'brand is required' }, { status: 400 });
  if (!name?.trim())        return Response.json({ error: 'name is required' }, { status: 400 });
  if (!category?.trim())    return Response.json({ error: 'category is required' }, { status: 400 });

  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO "Product" (id, "styleNumber", vendor, brand, name, category, subcategory, "productType", gender, "isActive", "sortOrder", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, true, $9, NOW(), NOW())
       RETURNING *`,
      [styleNumber.trim(), vendor.trim(), brand.trim(), name.trim(), category.trim(),
       subcategory?.trim() || null, productType?.trim() || null, gender?.trim() || null,
       sortOrder ?? 0],
    );
    return Response.json({ product: result.rows[0] }, { status: 201 });
  } catch (err: unknown) {
    const pg = err as { code?: string };
    if (pg?.code === '23505') {
      return Response.json({ error: `Style number "${styleNumber}" already exists` }, { status: 409 });
    }
    console.error('[POST /api/products]', err);
    return Response.json({ error: 'Failed to create product' }, { status: 500 });
  } finally {
    client.release();
  }
}
