import { pool } from '@/lib/pool';
import { sendEmail, buildSubmissionConfirmationEmail, buildNewRequestAdminEmail } from '@/lib/email';

const EDIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

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
      `SELECT u.id, u."firstName", u."lastName", u.email FROM "OrganizationMembership" om
       JOIN "User" u ON u.id = om."userId"
       WHERE om."organizationId" = $1 AND u.id = $2 AND u."userType" = 'CLIENT'`,
      [orgId, userId]
    );
    if (!userCheck.rows[0]) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const row = userCheck.rows[0];
    const clientName = `${row.firstName || ''} ${row.lastName || ''}`.trim() || 'there';
    const clientEmail = userCheck.rows[0].email || null;

    const lineItemsArr = Array.isArray(lineItems) && lineItems.length > 0 ? lineItems : [];

    // Step 6 — Project Conversion: look up defaultBlankCost by productId for any
    // garmentVariants that carry a catalog product reference. This future-proofs
    // the portal submit for when the Client Hub starts sending productId. Historical
    // quotes are never touched — only new submissions receive this cost.
    // Pricing hierarchy: Manual Override > Quote Snapshot > Product Default Cost > No Cost
    const productIdSet = new Set<string>();
    for (const item of lineItemsArr) {
      for (const v of (item.garmentVariants || [])) {
        if (v?.productId) productIdSet.add(v.productId);
      }
    }
    const productCostMap: Record<string, number> = {};
    if (productIdSet.size > 0) {
      const costRows = await pool.query(
        `SELECT id, "defaultBlankCost" FROM "Product" WHERE id = ANY($1::text[]) AND "defaultBlankCost" IS NOT NULL`,
        [Array.from(productIdSet)],
      );
      for (const row of costRows.rows) {
        const c = parseFloat(row.defaultBlankCost);
        if (!isNaN(c) && c > 0) productCostMap[row.id] = c;
      }
    }

    const lineItemsData = lineItemsArr.map((item: any, i: number) => {
      const firstProductId = (item.garmentVariants || []).find((v: any) => v?.productId)?.productId;
      const resolvedCost = firstProductId != null && productCostMap[firstProductId] != null
        ? productCostMap[firstProductId]
        : 0;
      return {
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
        mockupUri: item.mockupUri || null,
        productCostEach: resolvedCost,
        serviceCostEach: 0,
        serviceFeeEach: 0,
        markupEach: 0,
      };
    });

    const mappedOrderType = mapOrderType(orderType || 'New Order');

    const submittedOrderDate = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

    const projectResult = await pool.query(
      `INSERT INTO "Project" (
        id, title, "clientName", "organizationId",
        "orderType", "orderDate", "inHandsDate",
        "hasOnlineFee", "hasSalesTax", "hasCardFee",
        calculations, "salesData", "lineItemsData",
        "frontendStatus", status, "intakeSource",
        "createdByUserId", "notesClient",
        "isLocked", "exportedToSheets", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3,
        $4, $5, $6,
        true, false, true,
        NULL::jsonb, NULL::jsonb, $7::jsonb,
        'needs_review', 'NEEDS_REVIEW'::"ProjectStatus", 'CLIENT_HUB'::"IntakeSource",
        $8, $9,
        false, false, NOW(), NOW()
      ) RETURNING *`,
      [
        title.trim(),
        orgName || orgCheck.rows[0].name,
        orgId,
        mappedOrderType,
        submittedOrderDate,
        inHandsDate || null,
        JSON.stringify(lineItemsData),
        userId,
        notes || null,
      ]
    );

    const project = projectResult.rows[0];

    // Create ProjectItem records for structured querying
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

    // Determine portal URL for "View Your Request" link
    const basePortalUrl = body.portalUrl || `${process.env.REPLIT_DEV_DOMAIN || ''}/portal/${orgId}`;
    const projectPortalUrl = `${basePortalUrl}?tab=projects`;

    // Determine admin URL for internal notification
    const adminBaseUrl = process.env.REPLIT_DEV_DOMAIN || '';
    const adminProjectUrl = `${adminBaseUrl}/quote/${project.id}`;

    // Send confirmation email to client (non-blocking)
    let emailSent = false;
    if (clientEmail) {
      const { subject, html, text } = buildSubmissionConfirmationEmail({
        clientName,
        projectName: title.trim(),
        orgName: orgName || orgCheck.rows[0].name,
        inHandsDate: inHandsDate || '',
        lineItems: lineItemsData.map((li: any) => ({
          designName: li.designName,
          serviceStyle: li.serviceStyle,
          product: li.product || '',
          productColor: li.productColor || '',
          location1: li.location1 || '',
          location2: li.location2 || '',
          location3: li.location3 || '',
          location4: li.location4 || '',
          locationDetails: li.locationDetails || '',
          sizes: li.sizes || {},
        })),
        notes: notes || '',
        portalUrl: projectPortalUrl,
      });

      const emailResult = await sendEmail({ to: clientEmail, subject, html, text });
      if (emailResult.error) {
        console.error('[portal/submit] Confirmation email failed:', emailResult.error);
      } else {
        console.log(`[portal/submit] Confirmation email sent to ${clientEmail} — id: ${emailResult.id}`);
        emailSent = true;
      }
    } else {
      console.warn('[portal/submit] No client email found — skipping confirmation email');
    }

    // Send admin notification to jobs@katalystko.com (non-blocking)
    try {
      const { subject: aSubj, html: aHtml, text: aTxt } = buildNewRequestAdminEmail({
        projectName: title.trim(),
        orgName: orgName || orgCheck.rows[0].name,
        clientName,
        clientEmail: clientEmail || '(no email)',
        inHandsDate: inHandsDate || '',
        lineItems: lineItemsData.map((li: any) => ({
          designName: li.designName,
          serviceStyle: li.serviceStyle,
          product: li.product || '',
          productColor: li.productColor || '',
          location1: li.location1 || '',
          location2: li.location2 || '',
          location3: li.location3 || '',
          location4: li.location4 || '',
          locationDetails: li.locationDetails || '',
          sizes: li.sizes || {},
        })),
        notes: notes || '',
        adminUrl: adminProjectUrl,
      });
      const adminResult = await sendEmail({ to: 'jobs@katalystko.com', subject: aSubj, html: aHtml, text: aTxt });
      if (adminResult.error) {
        console.error('[portal/submit] Admin notification email failed:', adminResult.error);
      } else {
        console.log(`[portal/submit] Admin notification sent to jobs@katalystko.com — id: ${adminResult.id}`);
      }
    } catch (adminEmailErr) {
      console.error('[portal/submit] Admin notification email error (non-fatal):', adminEmailErr);
    }

    return Response.json({
      id: project.id,
      title: project.title,
      status: 'needs_review',
      intakeSource: 'CLIENT_HUB',
      lineItemCount: lineItemsData.length,
      createdAt: project.createdAt,
      emailSent,
    }, { status: 201 });

  } catch (err) {
    console.error('[POST /api/portal/submit]', err);
    return Response.json({ error: 'Failed to submit project' }, { status: 500 });
  }
}

// Cancel a recently submitted project (within edit window)
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { projectId, userId, orgId } = body;

    if (!projectId || !userId || !orgId) {
      return Response.json({ error: 'Missing required fields: projectId, userId, orgId' }, { status: 400 });
    }

    // Verify ownership and that it's within the edit window
    const projectCheck = await pool.query(
      `SELECT id, "createdAt", "createdByUserId", "organizationId"
       FROM "Project"
       WHERE id = $1 AND "createdByUserId" = $2 AND "organizationId" = $3
         AND status = 'NEEDS_REVIEW'::"ProjectStatus"`,
      [projectId, userId, orgId]
    );

    if (!projectCheck.rows[0]) {
      return Response.json({ error: 'Project not found or you do not have permission to cancel it' }, { status: 404 });
    }

    const createdAt = new Date(projectCheck.rows[0].createdAt).getTime();
    const elapsed = Date.now() - createdAt;

    if (elapsed > EDIT_WINDOW_MS) {
      return Response.json({ error: 'Edit window has expired (10 minutes)' }, { status: 403 });
    }

    // Cancel the project
    await pool.query(
      `UPDATE "Project"
       SET status = 'CANCELLED'::"ProjectStatus", "frontendStatus" = 'cancelled', "updatedAt" = NOW()
       WHERE id = $1`,
      [projectId]
    );

    await pool.query(
      `INSERT INTO "ActivityLog" (
        id, "organizationId", "projectId", "userId",
        "actionType", "actionSummary", metadata, "createdAt"
      ) VALUES (gen_random_uuid(), $1, $2, $3, 'client_cancel', $4, $5::jsonb, NOW())`,
      [
        orgId,
        projectId,
        userId,
        'Client cancelled project request within edit window',
        JSON.stringify({ cancelledWithinMinutes: Math.floor(elapsed / 60000) }),
      ]
    );

    return Response.json({ ok: true, cancelled: true });
  } catch (err) {
    console.error('[DELETE /api/portal/submit]', err);
    return Response.json({ error: 'Failed to cancel project' }, { status: 500 });
  }
}
