import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized, forbidden } from '@/lib/auth';
import { toEnrichedContact } from '@/lib/contacts';
import { formatPhoneOrNull } from '@/utils/phone';
import type { Organization, Contact, ActivityEntry, CampaignAssignment, Department } from '@/types/crm';

/**
 * CRM CONSOLIDATION — the org list uses the SAME enriched contact derivation as
 * the org detail endpoint (lib/contacts.toEnrichedContact), keyed strictly on
 * Contact.linkedUserId -> User(CLIENT) -> OrganizationMembership. No email
 * matching (it drifts because email is non-unique across orgs). This guarantees
 * Hub Access / Org Admin / counts are identical everywhere people are shown.
 */
function enrichListContact(
  c: any,
  userById: Map<string, any>,
  membershipByKey: Map<string, any>,
): Contact {
  const u = c.linkedUserId ? userById.get(c.linkedUserId) : null;
  const m = u ? membershipByKey.get(`${u.id}:${c.organizationId}`) : null;
  return toEnrichedContact({
    ...c,
    userStatus: u?.status ?? null,
    passwordHash: u?.passwordHash ?? null,
    lastLoginAt: u?.lastLoginAt ?? null,
    membershipId: m?.id ?? null,
    membershipRole: m?.role ?? null,
    inviteSentAt: m?.inviteSentAt ?? null,
  });
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

function toFrontendOrg(org: any, contacts: Contact[], activityLogs: any[]): Organization {
  return {
    id: org.id,
    name: org.name,
    type: org.type ?? undefined,
    city: org.city ?? undefined,
    state: org.state ?? undefined,
    notes: org.notes ?? undefined,
    address: org.address ?? undefined,
    zip: undefined,
    status: (org.crmStatus || 'Cold') as Organization['status'],
    convertedToActiveDate: org.convertedToActiveDate
      ? new Date(org.convertedToActiveDate).toISOString()
      : undefined,
    contacts,
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

export async function GET(request: Request) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();

  try {
    const [orgsResult, contactsResult, logsResult, usersResult, membershipsResult] = await Promise.all([
      pool.query(`SELECT * FROM "Organization" ORDER BY "createdAt" DESC`),
      pool.query(`SELECT * FROM "Contact" ORDER BY "isPrimary" DESC`),
      pool.query(`SELECT * FROM "ActivityLog" WHERE "organizationId" IS NOT NULL ORDER BY "createdAt" DESC`),
      pool.query(`SELECT id, status, "passwordHash", "lastLoginAt" FROM "User" WHERE "userType" = 'CLIENT'`),
      pool.query(`SELECT id, "userId", "organizationId", role, "inviteSentAt" FROM "OrganizationMembership"`),
    ]);

    const userById = new Map<string, any>();
    for (const u of usersResult.rows) userById.set(u.id, u);
    const membershipByKey = new Map<string, any>();
    for (const m of membershipsResult.rows) membershipByKey.set(`${m.userId}:${m.organizationId}`, m);

    const contactsByOrg: Record<string, Contact[]> = {};
    for (const c of contactsResult.rows) {
      if (c.organizationId) {
        contactsByOrg[c.organizationId] = contactsByOrg[c.organizationId] || [];
        contactsByOrg[c.organizationId].push(enrichListContact(c, userById, membershipByKey));
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
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();

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

    let contacts: Contact[] = [];
    if (body.contact) {
      const c = body.contact;
      const cResult = await pool.query(
        `INSERT INTO "Contact" (
          id, "organizationId", "firstName", "lastName", email, phone, role, notes, "isPrimary", "createdAt", "updatedAt"
        ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING *`,
        [org.id, c.firstName || '', c.lastName || '', c.email ?? null, formatPhoneOrNull(c.phone), c.role ?? null, c.notes ?? null, c.isPrimary ?? false],
      );
      // A freshly-created contact has no linked user yet -> enriches to "No Access".
      contacts = cResult.rows.map((row) => enrichListContact(row, new Map(), new Map()));
    }

    return Response.json(toFrontendOrg(org, contacts, []), { status: 201 });
  } catch (err) {
    console.error('[POST /api/orgs]', err);
    return Response.json({ error: 'Failed to create organization' }, { status: 500 });
  }
}
