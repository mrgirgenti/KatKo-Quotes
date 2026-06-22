import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized, forbidden } from '@/lib/auth';
import type { Organization, Contact, ActivityEntry, CampaignAssignment, Department } from '@/types/crm';

function toFrontendContact(c: any): Contact {
  return {
    id: c.id,
    organizationId: c.organizationId ?? undefined,
    departmentId: undefined,
    firstName: c.firstName,
    lastName: c.lastName,
    role: c.role ?? undefined,
    email: c.email ?? undefined,
    phone: c.phone ?? undefined,
    notes: c.notes ?? undefined,
    isPrimary: c.isPrimary ?? false,
    linkedUserId: c.linkedUserId ?? undefined,
    createdAt: new Date(c.createdAt).toISOString(),
  };
}

function toFrontendActivity(a: any): ActivityEntry {
  const meta = a.metadata || {};
  return {
    id: a.id,
    type: (a.actionType || 'note') as ActivityEntry['type'],
    date: meta.date || new Date(a.createdAt).toISOString().split('T')[0],
    subject: meta.subject ?? undefined,
    body: a.actionSummary || '',
    contactId: meta.contactId ?? undefined,
    contactName: meta.contactName ?? undefined,
    createdAt: new Date(a.createdAt).toISOString(),
  };
}

function toFrontendOrg(org: any, contacts: any[], activityLogs: any[]): Organization {
  return {
    id: org.id,
    name: org.name,
    type: org.type ?? undefined,
    city: org.city ?? undefined,
    state: org.state ?? undefined,
    notes: org.notes ?? undefined,
    address: org.address ?? undefined,
    zip: undefined,
    website: org.website ?? undefined,
    status: (org.crmStatus || 'Cold') as Organization['status'],
    convertedToActiveDate: org.convertedToActiveDate
      ? new Date(org.convertedToActiveDate).toISOString()
      : undefined,
    contacts: contacts.map(toFrontendContact),
    activityLog: activityLogs.map(toFrontendActivity),
    campaigns: (org.campaignsData as CampaignAssignment[] | null) || [],
    departments: (org.departmentsData as Department[] | null) || [],
    hubEnabled: org.hubEnabled ?? false,
    hubEverEnabled: org.hubEverEnabled ?? false,
    logoUrl: org.logoUrl ?? undefined,
    internalLogoUrl: org.internalLogoUrl ?? undefined,
    createdAt: new Date(org.createdAt).toISOString(),
  };
}

export async function GET(request: Request, { id }: { id: string }) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();

  try {
    const [orgResult, contactsResult, logsResult] = await Promise.all([
      pool.query(`SELECT * FROM "Organization" WHERE id = $1`, [id]),
      pool.query(`SELECT * FROM "Contact" WHERE "organizationId" = $1 ORDER BY "isPrimary" DESC`, [id]),
      pool.query(`SELECT * FROM "ActivityLog" WHERE "organizationId" = $1 ORDER BY "createdAt" DESC`, [id]),
    ]);
    if (!orgResult.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(toFrontendOrg(orgResult.rows[0], contactsResult.rows, logsResult.rows));
  } catch (err) {
    return Response.json({ error: 'Failed to load org' }, { status: 500 });
  }
}

export async function PUT(request: Request, { id }: { id: string }) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();

  try {
    const body = await request.json();
    const existingResult = await pool.query(`SELECT * FROM "Organization" WHERE id = $1`, [id]);
    if (!existingResult.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    const existing = existingResult.rows[0];

    const becameActive =
      body.status === 'Active Client' &&
      existing.crmStatus !== 'Active Client' &&
      !existing.convertedToActiveDate;

    const orgResult = await pool.query(
      `UPDATE "Organization" SET
        name = COALESCE($1, name),
        type = $2,
        city = $3,
        state = $4,
        notes = $5,
        "crmStatus" = COALESCE($6, "crmStatus"),
        "convertedToActiveDate" = $7,
        "campaignsData" = $8::jsonb,
        "departmentsData" = $9::jsonb,
        "hubEnabled" = $10,
        "logoUrl" = $11,
        "internalLogoUrl" = $12,
        website = $13,
        "hubEverEnabled" = $14,
        "updatedAt" = NOW()
      WHERE id = $15 RETURNING *`,
      [
        body.name ?? existing.name,
        body.type !== undefined ? body.type : existing.type,
        body.city !== undefined ? body.city : existing.city,
        body.state !== undefined ? body.state : existing.state,
        body.notes !== undefined ? body.notes : existing.notes,
        body.status ?? existing.crmStatus,
        becameActive ? new Date() : existing.convertedToActiveDate,
        JSON.stringify(body.campaigns !== undefined ? body.campaigns : (existing.campaignsData ?? [])),
        JSON.stringify(body.departments !== undefined ? body.departments : (existing.departmentsData ?? [])),
        body.hubEnabled !== undefined ? body.hubEnabled : (existing.hubEnabled ?? false),
        body.logoUrl !== undefined ? (body.logoUrl || null) : (existing.logoUrl ?? null),
        body.internalLogoUrl !== undefined ? (body.internalLogoUrl || null) : (existing.internalLogoUrl ?? null),
        body.website !== undefined ? (body.website || null) : (existing.website ?? null),
        body.hubEnabled === true ? true : (existing.hubEverEnabled ?? false),
        id,
      ],
    );

    const [contactsResult, logsResult] = await Promise.all([
      pool.query(`SELECT * FROM "Contact" WHERE "organizationId" = $1 ORDER BY "isPrimary" DESC`, [id]),
      pool.query(`SELECT * FROM "ActivityLog" WHERE "organizationId" = $1 ORDER BY "createdAt" DESC`, [id]),
    ]);

    return Response.json(toFrontendOrg(orgResult.rows[0], contactsResult.rows, logsResult.rows));
  } catch (err) {
    console.error('[PUT /api/orgs/:id]', err);
    return Response.json({ error: 'Failed to update org' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { id }: { id: string }) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();
  if (authedUser.role !== 'org_admin') return forbidden('Only admins can delete organizations');

  try {
    await pool.query(`DELETE FROM "Organization" WHERE id = $1`, [id]);
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/orgs/:id]', err);
    return Response.json({ error: 'Failed to delete org' }, { status: 500 });
  }
}
