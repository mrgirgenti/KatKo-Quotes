import { pool } from '@/lib/pool';
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
    address: undefined,
    zip: undefined,
    website: undefined,
    status: (org.crmStatus || 'Cold') as Organization['status'],
    convertedToActiveDate: org.convertedToActiveDate
      ? new Date(org.convertedToActiveDate).toISOString()
      : undefined,
    contacts: contacts.map(toFrontendContact),
    activityLog: activityLogs.map(toFrontendActivity),
    campaigns: (org.campaignsData as CampaignAssignment[] | null) || [],
    departments: (org.departmentsData as Department[] | null) || [],
    hubEnabled: org.hubEnabled ?? false,
    logoUrl: org.logoUrl ?? undefined,
    internalLogoUrl: org.internalLogoUrl ?? undefined,
    createdAt: new Date(org.createdAt).toISOString(),
  };
}

export async function GET() {
  try {
    const [orgsResult, contactsResult, logsResult] = await Promise.all([
      pool.query(`SELECT * FROM "Organization" ORDER BY "createdAt" DESC`),
      pool.query(`SELECT * FROM "Contact" ORDER BY "isPrimary" DESC`),
      pool.query(`SELECT * FROM "ActivityLog" WHERE "organizationId" IS NOT NULL ORDER BY "createdAt" DESC`),
    ]);

    const contactsByOrg: Record<string, any[]> = {};
    for (const c of contactsResult.rows) {
      if (c.organizationId) {
        contactsByOrg[c.organizationId] = contactsByOrg[c.organizationId] || [];
        contactsByOrg[c.organizationId].push(c);
      }
    }

    const logsByOrg: Record<string, any[]> = {};
    for (const a of logsResult.rows) {
      if (a.organizationId) {
        logsByOrg[a.organizationId] = logsByOrg[a.organizationId] || [];
        logsByOrg[a.organizationId].push(a);
      }
    }

    const result = orgsResult.rows.map((org) =>
      toFrontendOrg(org, contactsByOrg[org.id] || [], logsByOrg[org.id] || []),
    );
    return Response.json(result);
  } catch (err) {
    console.error('[GET /api/orgs]', err);
    return Response.json({ error: 'Failed to load organizations' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const setActive = body.status === 'Active Client';
    const now = new Date();

    const orgResult = await pool.query(
      `INSERT INTO "Organization" (
        id, name, type, city, state, notes, "crmStatus", "convertedToActiveDate",
        "campaignsData", "departmentsData", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, NOW(), NOW()
      ) RETURNING *`,
      [
        body.name,
        body.type ?? null,
        body.city ?? null,
        body.state ?? null,
        body.notes ?? null,
        body.status || 'Cold',
        setActive ? now : null,
        JSON.stringify(body.campaigns ?? []),
        JSON.stringify(body.departments ?? []),
      ],
    );
    const org = orgResult.rows[0];

    let contacts: any[] = [];
    if (body.contact) {
      const c = body.contact;
      const cResult = await pool.query(
        `INSERT INTO "Contact" (
          id, "organizationId", "firstName", "lastName", email, phone, role, notes, "isPrimary", "createdAt", "updatedAt"
        ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING *`,
        [org.id, c.firstName || '', c.lastName || '', c.email ?? null, c.phone ?? null, c.role ?? null, c.notes ?? null, c.isPrimary ?? false],
      );
      contacts = cResult.rows;
    }

    return Response.json(toFrontendOrg(org, contacts, []), { status: 201 });
  } catch (err) {
    console.error('[POST /api/orgs]', err);
    return Response.json({ error: 'Failed to create organization' }, { status: 500 });
  }
}
