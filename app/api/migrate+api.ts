import { pool } from '@/lib/pool';
import type { Organization } from '@/types/crm';
import type { Quote } from '@/types/quote';

function frontendStatusToDbStatus(s: string) {
  switch (s) {
    case 'draft': return 'DRAFT';
    case 'quoted': return 'QUOTE_SENT';
    case 'active': return 'IN_PRODUCTION';
    case 'production_started': return 'IN_PRODUCTION';
    case 'completed': return 'COMPLETED';
    case 'expired': return 'CANCELLED';
    default: return 'DRAFT';
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const orgs: Organization[] = body.orgs || [];
    const quotes: Quote[] = body.quotes || [];

    let orgsCreated = 0;
    let quotesCreated = 0;

    for (const org of orgs) {
      try {
        await pool.query(
          `INSERT INTO "Organization" (
            id, name, type, city, state, notes, "crmStatus", "convertedToActiveDate",
            "campaignsData", "departmentsData", "createdAt", "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, NOW())
          ON CONFLICT (id) DO NOTHING`,
          [
            org.id,
            org.name,
            org.type ?? null,
            org.city ?? null,
            org.state ?? null,
            org.notes ?? null,
            org.status || 'Cold',
            org.convertedToActiveDate ? new Date(org.convertedToActiveDate) : null,
            JSON.stringify(org.campaigns ?? []),
            JSON.stringify(org.departments ?? []),
            org.createdAt ? new Date(org.createdAt) : new Date(),
          ],
        );

        for (const c of org.contacts || []) {
          try {
            await pool.query(
              `INSERT INTO "Contact" (
                id, "organizationId", "firstName", "lastName", email, phone, role, notes, "isPrimary", "createdAt", "updatedAt"
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
              ON CONFLICT (id) DO NOTHING`,
              [
                c.id,
                org.id,
                c.firstName || '',
                c.lastName || '',
                c.email ?? null,
                c.phone ?? null,
                c.role ?? null,
                c.notes ?? null,
                c.isPrimary ?? false,
                c.createdAt ? new Date(c.createdAt) : new Date(),
              ],
            );
          } catch { }
        }

        for (const a of org.activityLog || []) {
          try {
            const meta = {
              date: a.date || new Date().toISOString().split('T')[0],
              subject: a.subject ?? null,
              contactId: a.contactId ?? null,
              contactName: a.contactName ?? null,
            };
            await pool.query(
              `INSERT INTO "ActivityLog" (
                id, "organizationId", "actionType", "actionSummary", metadata, "createdAt"
              ) VALUES ($1, $2, $3, $4, $5::jsonb, $6)
              ON CONFLICT (id) DO NOTHING`,
              [
                a.id,
                org.id,
                a.type || 'note',
                a.body || '',
                JSON.stringify(meta),
                a.createdAt ? new Date(a.createdAt) : new Date(),
              ],
            );
          } catch { }
        }

        orgsCreated++;
      } catch { }
    }

    for (const q of quotes) {
      try {
        await pool.query(
          `INSERT INTO "Project" (
            id, title, "clientName", "organizationId", "orderType", "orderDate", "inHandsDate",
            "invoiceNumber", "hasOnlineFee", "hasSalesTax", "hasCardFee",
            calculations, "salesData", "lineItemsData", "frontendStatus", status,
            "createdByUserId", "activeDate", "isLocked", "lockedDate",
            "exportedToSheets", "exportedToSheetsDate", "createdAt", "updatedAt"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
            $12::jsonb, $13::jsonb, $14::jsonb, $15, $16::"ProjectStatus",
            $17, $18, $19, $20, $21, $22, $23, NOW()
          ) ON CONFLICT (id) DO NOTHING`,
          [
            q.id,
            q.projectName || 'Untitled',
            q.personOrganization || '',
            q.orgId ?? null,
            q.orderType || 'New',
            q.orderDate || null,
            q.inHandsDate || null,
            q.invoiceNumber || null,
            q.hasOnlineFee ?? true,
            q.hasSalesTax ?? false,
            q.hasCardFee ?? true,
            JSON.stringify(q.calculations ?? null),
            JSON.stringify(q.salesData ?? null),
            JSON.stringify(q.lineItems ?? []),
            q.status || 'quoted',
            frontendStatusToDbStatus(q.status || 'quoted'),
            (q.userId && q.userId !== 'default') ? q.userId : null,
            (q as any).activeDate ?? null,
            (q as any).isLocked ?? false,
            (q as any).lockedDate ?? null,
            (q as any).exportedToSheets ?? false,
            (q as any).exportedToSheetsDate ?? null,
            q.createdAt ? new Date(q.createdAt) : new Date(),
          ],
        );
        quotesCreated++;
      } catch { }
    }

    return Response.json({ ok: true, orgsCreated, quotesCreated });
  } catch (err) {
    console.error('[POST /api/migrate]', err);
    return Response.json({ error: 'Migration failed' }, { status: 500 });
  }
}
