import { pool } from '@/lib/pool';
import type { Contact } from '@/types/crm';

/**
 * CRM CONSOLIDATION — single source of truth for people.
 *
 * Contacts are the only people-management read model. Each Contact row is
 * enriched with the derived hub-access state by LEFT JOINing the (invisible)
 * auth substrate: Contact.linkedUserId -> User (CLIENT) -> OrganizationMembership.
 *
 * The User/OrganizationMembership rows exist ONLY to back portal login; they are
 * never read or managed as a separate people list anywhere in the UI.
 */

export type HubAccessState = 'none' | 'invited' | 'enabled' | 'disabled';

// Status pill text shown in the Contacts table / Client Hub card.
export function hubStatusLabel(state: HubAccessState): Contact['hubStatus'] {
  switch (state) {
    case 'enabled':
      return 'Active';
    case 'invited':
      return 'Invited';
    case 'disabled':
      return 'Disabled';
    default:
      return 'No Access';
  }
}

/**
 * Derivation rules (the single, authoritative mapping):
 *  - no membership            -> none      (Status: "Contact Only")
 *  - membership + DISABLED     -> disabled  (Status: "Disabled")
 *  - membership + INVITED|!pwd -> invited   (Status: "Invited")
 *  - membership + ACTIVE + pwd -> enabled   (Status: "Active")
 */
export function deriveHubAccess(row: any): HubAccessState {
  const hasMembership = !!row.membershipId;
  if (!hasMembership) return 'none';
  const userStatus = row.userStatus as string | null;
  const hasPassword = !!row.passwordHash;
  if (userStatus === 'DISABLED') return 'disabled';
  if (userStatus === 'INVITED' || !hasPassword) return 'invited';
  return 'enabled';
}

export function toEnrichedContact(row: any): Contact {
  const hubAccess = deriveHubAccess(row);
  const lastLoginAt = row.lastLoginAt ? new Date(row.lastLoginAt).toISOString() : null;
  const inviteSentAt = row.inviteSentAt ? new Date(row.inviteSentAt).toISOString() : null;
  return {
    id: row.id,
    organizationId: row.organizationId ?? undefined,
    departmentId: row.departmentId ?? undefined,
    firstName: row.firstName,
    lastName: row.lastName,
    role: row.role ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    notes: row.notes ?? undefined,
    isPrimary: row.isPrimary ?? false,
    status: row.status === 'inactive' ? 'inactive' : 'active',
    linkedUserId: row.linkedUserId ?? undefined,
    createdAt: new Date(row.createdAt).toISOString(),
    // ── Derived hub fields (single source of truth) ──
    hubAccess,
    hubStatus: hubStatusLabel(hubAccess),
    isOrgAdmin: !!row.membershipId && row.membershipRole === 'ORG_ADMIN',
    userStatus: (row.userStatus as Contact['userStatus']) ?? undefined,
    membershipId: row.membershipId ?? undefined,
    lastLoginAt,
    inviteSentAt,
    lastActivityAt: lastLoginAt || inviteSentAt || null,
  };
}

const ENRICHED_CONTACTS_SQL = `
  SELECT c.*,
    u.id            AS "userId",
    u.status        AS "userStatus",
    u."passwordHash" AS "passwordHash",
    u."lastLoginAt" AS "lastLoginAt",
    om.id           AS "membershipId",
    om.role         AS "membershipRole",
    om."inviteSentAt" AS "inviteSentAt"
  FROM "Contact" c
  LEFT JOIN "User" u
    ON u.id = c."linkedUserId" AND u."userType" = 'CLIENT'
  LEFT JOIN "OrganizationMembership" om
    ON om."organizationId" = c."organizationId" AND om."userId" = u.id
  WHERE c."organizationId" = $1
  ORDER BY c."isPrimary" DESC, c."createdAt" ASC
`;

export async function fetchEnrichedContacts(orgId: string): Promise<Contact[]> {
  const result = await pool.query(ENRICHED_CONTACTS_SQL, [orgId]);
  return result.rows.map(toEnrichedContact);
}
