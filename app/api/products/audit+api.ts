import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized } from '@/lib/auth';

export async function GET(request: Request) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();

  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT
        p.id,
        p."styleNumber",
        p.brand,
        p.name,
        p.category,
        p.subcategory,
        p."isActive",
        p."isLegacy",
        p."recommendationLevel",
        p."defaultBlankCost",
        p."lastCostUpdatedAt",
        p."templateId",
        p."updatedAt",
        COALESCE(color_ct.cnt, 0)::int     AS "colorCount",
        COALESCE(asset_ct.cnt, 0)::int     AS "assetCount",
        COALESCE(placement_ct.cnt, 0)::int AS "placementCount",
        COALESCE(vendor_ct.cnt, 0)::int    AS "vendorCount"
      FROM "Product" p
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
      LEFT JOIN (
        SELECT "productId", COUNT(*)::int AS cnt
        FROM "ProductVendor" WHERE "isActive" = true GROUP BY "productId"
      ) vendor_ct ON vendor_ct."productId" = p.id
      WHERE p."isActive" = true
      ORDER BY p."sortOrder" ASC, p.brand ASC, p.name ASC
    `);

    const products = result.rows;
    const now = new Date();
    const staleThresholdDays = 90;

    const missingCost:     typeof products = [];
    const missingColors:   typeof products = [];
    const missingAssets:   typeof products = [];
    const missingTemplate: typeof products = [];
    const missingVendors:  typeof products = [];
    const missingRec:      typeof products = [];
    const staleCost:       typeof products = [];
    const neverUpdated:    typeof products = [];
    const zeroCost:        typeof products = [];

    const categoryMap: Record<string, { total: number; withCost: number }> = {};

    for (const p of products) {
      const costNum = p.defaultBlankCost != null ? parseFloat(String(p.defaultBlankCost)) : null;

      if (costNum === null || isNaN(costNum as number)) {
        missingCost.push(p);
      } else if (costNum === 0) {
        zeroCost.push(p);
      } else if (p.lastCostUpdatedAt) {
        const daysSince = (now.getTime() - new Date(p.lastCostUpdatedAt).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince > staleThresholdDays) staleCost.push(p);
      }

      if (p.colorCount === 0) missingColors.push(p);
      if (p.assetCount === 0) missingAssets.push(p);
      if (!p.templateId && p.placementCount === 0) missingTemplate.push(p);
      if (p.vendorCount === 0) missingVendors.push(p);
      if (!p.recommendationLevel) missingRec.push(p);

      const daysSinceUpdate = (now.getTime() - new Date(p.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate > 180) neverUpdated.push(p);

      const cat = (p.category || 'Uncategorized') as string;
      if (!categoryMap[cat]) categoryMap[cat] = { total: 0, withCost: 0 };
      categoryMap[cat].total++;
      if (costNum !== null && !isNaN(costNum as number) && costNum > 0) categoryMap[cat].withCost++;
    }

    const withCost = products.filter(p => {
      const c = p.defaultBlankCost != null ? parseFloat(String(p.defaultBlankCost)) : null;
      return c !== null && !isNaN(c) && c > 0;
    }).length;
    const costCoverage = products.length > 0 ? Math.round((withCost / products.length) * 100) : 0;

    const categoryBreakdown = Object.entries(categoryMap)
      .map(([category, d]) => ({
        category,
        total: d.total,
        withCost: d.withCost,
        pct: d.total > 0 ? Math.round((d.withCost / d.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    const summary = {
      totalActive:    products.length,
      withCost,
      costCoverage,
      quoteReady: products.filter(p =>
        p.defaultBlankCost !== null &&
        p.colorCount > 0
      ).length,
      mockupReady: products.filter(p =>
        p.colorCount > 0 &&
        p.assetCount > 0 &&
        (p.templateId || p.placementCount > 0)
      ).length,
      withVendors:    products.filter(p => p.vendorCount > 0).length,
      withRecLevel:   products.filter(p => !!p.recommendationLevel).length,
    };

    const slim = (rows: typeof products) =>
      rows.map(p => ({
        id: p.id,
        styleNumber: p.styleNumber,
        brand: p.brand,
        name: p.name,
        recommendationLevel: p.recommendationLevel,
        defaultBlankCost: p.defaultBlankCost,
        lastCostUpdatedAt: p.lastCostUpdatedAt,
        colorCount: p.colorCount,
        assetCount: p.assetCount,
        placementCount: p.placementCount,
        vendorCount: p.vendorCount,
        templateId: p.templateId,
        updatedAt: p.updatedAt,
      }));

    return Response.json({
      summary,
      categoryBreakdown,
      missingCost:     slim(missingCost),
      zeroCost:        slim(zeroCost),
      missingColors:   slim(missingColors),
      missingAssets:   slim(missingAssets),
      missingTemplate: slim(missingTemplate),
      missingVendors:  slim(missingVendors),
      missingRec:      slim(missingRec),
      staleCost:       slim(staleCost),
      neverUpdated:    slim(neverUpdated),
    });
  } catch (err) {
    console.error('[GET /api/products/audit]', err);
    return Response.json({ error: 'Failed to run audit' }, { status: 500 });
  } finally {
    client.release();
  }
}
