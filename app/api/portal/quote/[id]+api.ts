import { pool } from '@/lib/pool';
import { sendEmail, buildQuoteApprovedNotificationEmail } from '@/lib/email';

export async function GET(_req: Request, { id }: { id: string }) {
  try {
    const result = await pool.query(
      `SELECT id, title, "clientName", "organizationId", "orderType",
              "inHandsDate", "lineItemsData", calculations,
              "frontendStatus", status, "intakeSource", "notesClient",
              "quoteSentAt", "waveInvoiceLink", "createdAt"
       FROM "Project" WHERE id = $1`,
      [id]
    );

    if (!result.rows[0]) {
      return Response.json({ error: 'Quote not found' }, { status: 404 });
    }

    const p = result.rows[0];

    if (p.status === 'NEEDS_REVIEW' || p.status === 'DRAFT') {
      return Response.json({ error: 'Quote is not yet ready for viewing' }, { status: 403 });
    }

    const lineItems: any[] = (p.lineItemsData as any[]) || [];
    const calculations: any = p.calculations || null;

    const clientLineItems = lineItems.map((item: any) => ({
      id: item.id,
      designName: item.designName || '',
      serviceStyle: item.serviceStyle || '',
      location1: item.location1 || '',
      location2: item.location2 || '',
      location3: item.location3 || '',
      location4: item.location4 || '',
      locationDetails: item.locationDetails || '',
      sizes: item.sizes || {},
      garmentVariants: (item.garmentVariants || []).map((v: any) => ({
        product: v.product || '',
        color: v.color || '',
        sizes: v.sizes || {},
      })),
    }));

    const orgResult = p.organizationId
      ? await pool.query(`SELECT name FROM "Organization" WHERE id = $1`, [p.organizationId])
      : { rows: [] };

    return Response.json({
      id: p.id,
      projectName: p.title || '',
      clientName: p.clientName || orgResult.rows[0]?.name || '',
      orgName: orgResult.rows[0]?.name || p.clientName || '',
      orderType: p.orderType || 'New',
      inHandsDate: p.inHandsDate || '',
      notesClient: p.notesClient || '',
      quoteSentAt: p.quoteSentAt || null,
      waveInvoiceLink: p.waveInvoiceLink || null,
      status: p.frontendStatus || 'quoted',
      lineItems: clientLineItems,
      total: calculations?.total ?? null,
      totalPerPiece: calculations?.totalPerPiece ?? null,
      hasCalculations: !!calculations,
    });
  } catch (err) {
    console.error('[GET /api/portal/quote/:id]', err);
    return Response.json({ error: 'Failed to load quote' }, { status: 500 });
  }
}

export async function POST(request: Request, { id }: { id: string }) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'approve') {
      // Fetch project details first for the email notification
      const projectResult = await pool.query(
        `SELECT p.id, p.title, p."clientName", p.calculations, p."organizationId",
                o.name AS "orgName"
         FROM "Project" p
         LEFT JOIN "Organization" o ON o.id = p."organizationId"
         WHERE p.id = $1 AND p.status NOT IN ('NEEDS_REVIEW', 'DRAFT')`,
        [id]
      );

      if (!projectResult.rows[0]) {
        return Response.json({ error: 'Not found or not approvable' }, { status: 404 });
      }

      const project = projectResult.rows[0];

      // Transition to QUOTE_SENT + quote_approved frontend status
      // (Quote is approved by client; awaiting invoice/payment — not yet in production)
      const updateResult = await pool.query(
        `UPDATE "Project"
         SET "frontendStatus" = 'quote_approved',
             status = 'QUOTE_SENT'::"ProjectStatus",
             "updatedAt" = NOW()
         WHERE id = $1 AND status NOT IN ('NEEDS_REVIEW', 'DRAFT')
         RETURNING id`,
        [id]
      );

      if (!updateResult.rows[0]) {
        return Response.json({ error: 'Not found or already processed' }, { status: 404 });
      }

      // Send real notification email to Katalyst Ko team
      const calculations = project.calculations as any;
      const total: number | null = calculations?.total ?? null;
      const orgName = project.orgName || project.clientName || '';
      const adminUrl = typeof globalThis !== 'undefined' && (globalThis as any).location
        ? `${(globalThis as any).location.origin}/quote/${id}`
        : `https://906806bc-a164-4b36-995b-783dc3fd5d73-00-310kzlkir9n18.spock.replit.dev/quote/${id}`;

      const { subject, html, text } = buildQuoteApprovedNotificationEmail({
        projectName: project.title || 'Untitled Project',
        orgName,
        submittedBy: body.approvedBy || project.clientName || 'Client',
        total,
        adminUrl,
      });

      const emailResult = await sendEmail({ to: 'jobs@katalystko.com', subject, html, text });
      if (emailResult.error) {
        console.error('[quote approve] Email notification failed:', emailResult.error);
      } else {
        console.log(`[quote approve] Notification sent — id: ${emailResult.id}`);
      }

      if (project.organizationId) {
        pool.query(
          `INSERT INTO "ActivityLog" (id, "organizationId", "projectId", "actionType", "actionSummary", metadata, "createdAt")
           VALUES (gen_random_uuid(), $1, $2, 'quote_approved', $3, $4::jsonb, NOW())`,
          [
            project.organizationId,
            id,
            `Quote approved by client: ${project.title || 'Untitled'}`,
            JSON.stringify({
              projectName: project.title,
              approvedBy: body.approvedBy || project.clientName,
              total,
            }),
          ],
        ).catch((err) => console.error('[quote approve] ActivityLog insert failed:', err));
      }

      return Response.json({
        ok: true,
        action: 'approved',
        projectName: project.title,
        orgName,
        total,
        emailSent: !emailResult.error,
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[POST /api/portal/quote/:id]', err);
    return Response.json({ error: 'Failed to process action' }, { status: 500 });
  }
}
