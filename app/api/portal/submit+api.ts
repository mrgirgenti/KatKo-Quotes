import { pool } from '@/lib/pool';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      orgId,
      userId,
      orgName,
      title,
      serviceType,
      quantity,
      dueDate,
      description,
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

    const qty = parseInt(quantity) || 0;
    const intakeLineItem = serviceType ? [{
      id: `intake_${Date.now()}`,
      designName: 'Client Request',
      serviceStyle: serviceType,
      product: '',
      productColor: '',
      apparelProvider: '',
      applicator: '',
      location1: '',
      location2: '',
      locationDetails: description || '',
      sizes: { xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0, xxxxl: 0, flat: qty },
      productCostEach: 0,
      serviceCostEach: 0,
      serviceFeeEach: 0,
      markupEach: 0,
    }] : [];

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
        'New', $4,
        true, false, true,
        NULL::jsonb, NULL::jsonb, $5::jsonb,
        'needs_review', 'NEEDS_REVIEW'::"ProjectStatus", 'CLIENT_HUB'::"IntakeSource",
        $6, $7,
        false, false, NOW(), NOW()
      ) RETURNING *`,
      [
        title.trim(),
        orgName || orgCheck.rows[0].name,
        orgId,
        dueDate || null,
        JSON.stringify(intakeLineItem),
        userId,
        description || null,
      ]
    );

    const project = projectResult.rows[0];

    await pool.query(
      `INSERT INTO "ActivityLog" (
        id, "organizationId", "projectId", "userId",
        "actionType", "actionSummary", metadata, "createdAt"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3,
        'client_intake',
        $4,
        $5::jsonb,
        NOW()
      )`,
      [
        orgId,
        project.id,
        userId,
        `Client submitted project intake: "${title.trim()}"`,
        JSON.stringify({
          source: 'CLIENT_HUB',
          serviceType: serviceType || null,
          quantity: qty || null,
          dueDate: dueDate || null,
        }),
      ]
    );

    return Response.json({
      id: project.id,
      title: project.title,
      status: 'needs_review',
      intakeSource: 'CLIENT_HUB',
      createdAt: project.createdAt,
    }, { status: 201 });

  } catch (err) {
    console.error('[POST /api/portal/submit]', err);
    return Response.json({ error: 'Failed to submit project' }, { status: 500 });
  }
}
