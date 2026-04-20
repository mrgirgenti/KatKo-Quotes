import { pool } from '@/lib/pool';

function mapOrderType(portalOrderType: string): string {
  if (portalOrderType === 'Reorder') return 'Re-Order';
  return 'New';
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      orgId,
      userId,
      orgName,
      title,
      orderType,
      inHandsDate,
      notes,
      lineItems,
    } = body;

    if (!orgId || !userId || !title?.trim()) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const orgCheck = await pool.query(
      `SELECT id, name FROM "Organization" WHERE id = $1 AND "hubEnabled" = true`,
      [orgId]
    );
    if (!orgCheck.rows[0]) {
      return Response.json({ error: 'Hub not found or not enabled' }, { status: 403 });
    }

    const userCheck = await pool.query(
      `SELECT u.id FROM "OrganizationMembership" om
       JOIN "User" u ON u.id = om."userId"
       WHERE om."organizationId" = $1 AND u.id = $2 AND u."userType" = 'CLIENT'`,
      [orgId, userId]
    );
    if (!userCheck.rows[0]) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // lineItems is an array of LineItem-compatible objects (without pricing).
    // Store directly in lineItemsData — same structure as the quote system.
    const lineItemsArr = Array.isArray(lineItems) && lineItems.length > 0
      ? lineItems
      : [];

    const lineItemsData = lineItemsArr.map((item: any, i: number) => ({
      id: item.id || `intake_${Date.now()}_${i}`,
      designName: item.designName || `Item ${i + 1}`,
      serviceStyle: item.serviceStyle || 'Screen Printing',
      applicator: item.applicator || 'Katalyst Ko Printshop',
      product: item.product || '',
      productColor: item.productColor || '',
      apparelProvider: item.apparelProvider || '',
      location1: item.location1 || '',
      location2: item.location2 || '',
      location3: item.location3 || '',
      location4: item.location4 || '',
      locationDetails: item.locationDetails || '',
      sizes: item.sizes || { xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0, xxxxl: 0, flat: 0 },
      garmentVariants: item.garmentVariants || [],
      productCostEach: 0,
      serviceCostEach: 0,
      serviceFeeEach: 0,
      markupEach: 0,
    }));

    const mappedOrderType = mapOrderType(orderType || 'New Order');

    const projectResult = await pool.query(
      `INSERT INTO "Project" (
        id, title, "clientName", "organizationId",
        "orderType", "inHandsDate",
        "hasOnlineFee", "hasSalesTax", "hasCardFee",
        calculations, "salesData", "lineItemsData",
        "frontendStatus", status, "intakeSource",
        "createdByUserId", "notesClient",
        "isLocked", "exportedToSheets", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3,
        $4, $5,
        true, false, true,
        NULL::jsonb, NULL::jsonb, $6::jsonb,
        'needs_review', 'NEEDS_REVIEW'::"ProjectStatus", 'CLIENT_HUB'::"IntakeSource",
        $7, $8,
        false, false, NOW(), NOW()
      ) RETURNING *`,
      [
        title.trim(),
        orgName || orgCheck.rows[0].name,
        orgId,
        mappedOrderType,
        inHandsDate || null,
        JSON.stringify(lineItemsData),
        userId,
        notes || null,
      ]
    );

    const project = projectResult.rows[0];

    // Also create ProjectItem records for each line item (for structured querying)
    for (const item of lineItemsData) {
      const totalQty = Object.values(item.sizes)
        .reduce((sum: number, v) => sum + ((v as number) || 0), 0);

      const printLocations = [item.location1, item.location2, item.location3, item.location4]
        .filter(Boolean);

      await pool.query(
        `INSERT INTO "ProjectItem" (
          id, "projectId", "itemName", "productCategory",
          "catalogStyle", color, "printMethod",
          quantity, "sizeBreakdown", "printLocations", "artworkNotes",
          "rawLineItemData", "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(), $1, $2, $3,
          $4, $5, $6,
          $7, $8::jsonb, $9::jsonb, $10,
          $11::jsonb, NOW(), NOW()
        )`,
        [
          project.id,
          item.designName,
          item.serviceStyle,
          item.product || null,
          item.productColor || null,
          item.serviceStyle || null,
          totalQty,
          JSON.stringify(item.sizes),
          JSON.stringify(printLocations),
          item.locationDetails || null,
          JSON.stringify(item),
        ]
      );
    }

    await pool.query(
      `INSERT INTO "ActivityLog" (
        id, "organizationId", "projectId", "userId",
        "actionType", "actionSummary", metadata, "createdAt"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3,
        'client_intake', $4, $5::jsonb, NOW()
      )`,
      [
        orgId,
        project.id,
        userId,
        `Client submitted project request: "${title.trim()}" (${lineItemsData.length} line item${lineItemsData.length !== 1 ? 's' : ''})`,
        JSON.stringify({
          source: 'CLIENT_HUB',
          lineItemCount: lineItemsData.length,
          orderType: mappedOrderType,
          inHandsDate: inHandsDate || null,
        }),
      ]
    );

    return Response.json({
      id: project.id,
      title: project.title,
      status: 'needs_review',
      intakeSource: 'CLIENT_HUB',
      lineItemCount: lineItemsData.length,
      createdAt: project.createdAt,
    }, { status: 201 });

  } catch (err) {
    console.error('[POST /api/portal/submit]', err);
    return Response.json({ error: 'Failed to submit project' }, { status: 500 });
  }
}
