import { pool } from '@/lib/pool';
import type { Organization, Contact, ActivityEntry, CampaignAssignment, Department } from '@/types/crm';

function hubStatusFromUser(u: any): Contact['hubStatus'] {
  if (!u) return 'No Access';
  if (u.status === 'ACTIVE') return 'Active';
  if (u.status === 'INVITED') return 'Invited';
  if (u.status === 'DISABLED') return 'Disabled';
  return 'No Access';
}

function toFrontendContact(c: any): Contact {
  const lu = c.__linkedUser;
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
    status: (c.status === 'inactive' ? 'inactive' : 'active'),
    linkedUserId: c.linkedUserId ?? lu?.id ?? undefined,
    hubStatus: hubStatusFromUser(lu),
    lastLoginAt: lu?.lastLoginAt ? new Date(lu.lastLoginAt).toISOString() : null,
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

export async function GET() {
  try {
    const [orgsResult, contactsResult, logsResult, usersResult, membershipsResult] = await Promise.all([
      pool.query(`SELECT * FROM "Organization" ORDER BY "createdAt" DESC`),
      pool.query(`SELECT * FROM "Contact" ORDER BY "isPrimary" DESC`),
      pool.query(`SELECT * FROM "ActivityLog" WHERE "organizationId" IS NOT NULL ORDER BY "createdAt" DESC`),
      pool.query(`SELECT id, email, status, "lastLoginAt" FROM "User" WHERE "userType" = 'CLIENT'`),
      pool.query(`SELECT "userId", "organizationId" FROM "OrganizationMembership"`),
    ]);

    const userById = new Map<string, any>();
    const userByEmail = new Map<string, any>();
    for (const u of usersResult.rows) {
      userById.set(u.id, u);
      if (u.email) userByEmail.set(String(u.email).toLowerCase(), u);
    }
    // user.id::orgId pairs — used to scope email fallback to same-org members only
    const membershipSet = new Set<string>();
    for (const m of membershipsResult.rows) {
      membershipSet.add(`${m.userId}:${m.organizationId}`);
    }
    // Explicit linkedUserId is authoritative. Email is only a fallback, and only
    // when that user is actually a member of the contact's organization (avoids
    // cross-org mis-attribution of hub status / last login).
    const matchUser = (c: any) => {
      if (c.linkedUserId) {
        const u = userById.get(c.linkedUserId);
        if (u) return u;
      }
      if (c.email && c.organizationId) {
        const u = userByEmail.get(String(c.email).toLowerCase());
        if (u && membershipSet.has(`${u.id}:${c.organizationId}`)) return u;
      }
      return null;
    };

    const contactsByOrg: Record<string, any[]> = {};
    for (const c of contactsResult.rows) {
      if (c.organizationId) {
        c.__linkedUser = matchUser(c);
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
