import { pool } from '@/lib/pool';
import { authenticateRequest, unauthorized } from '@/lib/auth';
import { sendEmail, buildClientInviteEmail, buildPasswordResetEmail } from '@/lib/email';
import { fetchEnrichedContacts } from '@/lib/contacts';
import { formatPhoneOrNull } from '@/utils/phone';
import crypto from 'crypto';

/**
 * CRM CONSOLIDATION — the single, contact-keyed write path for people + hub access.
 *
 * Every people/auth mutation flows through this endpoint keyed by contactId. The
 * User + OrganizationMembership rows are provisioned here as the invisible portal-login
 * substrate; they are never created or managed from a separate UI surface.
 *
 * PATCH actions:
 *   - enableHubAccess  : find/create CLIENT User by email, upsert membership,
 *                        link Contact.linkedUserId, (re)stamp invite, send invite email
 *   - disableHubAccess : set User.status='DISABLED' (keep membership + link so it is
 *                        re-enableable and shows "Disabled")
 *   - promoteAdmin     : membership role -> ORG_ADMIN
 *   - removeAdmin      : membership role -> MEMBER
 *   - resendInvite     : re-stamp invite + resend invite email
 *   - resetPassword    : issue reset token + send reset email
 */

async function loadContact(id: string, contactId: string) {
  const res = await pool.query(
    `SELECT c.*, o.name AS "orgName"
       FROM "Contact" c
       JOIN "Organization" o ON o.id = c."organizationId"
      WHERE c.id = $1 AND c."organizationId" = $2`,
    [contactId, id],
  );
  return res.rows[0] || null;
}

async function logActivity(orgId: string, type: string, summary: string, meta: Record<string, any>) {
  try {
    await pool.query(
      `INSERT INTO "ActivityLog" (id, "organizationId", "actionType", "actionSummary", metadata, "createdAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())`,
      [orgId, type, summary, JSON.stringify(meta)],
    );
  } catch {
    /* activity logging is best-effort */
  }
}

/** Raised when a people/auth action cannot proceed (surfaced as a 409 to the client). */
class HubAccessError extends Error {}

/** Find an existing CLIENT user by email (re-enabling if disabled) or create one. */
async function findOrCreateClientUser(contact: any): Promise<string> {
  const emailLower = String(contact.email).trim().toLowerCase();
  // User.email is globally unique, so at most one row matches. Only CLIENT users
  // back the portal; an email already owned by an INTERNAL teammate must NOT be
  // turned into a client login (it would also collide with the unique constraint).
  const existing = await pool.query(
    `SELECT id, status, "userType" FROM "User" WHERE LOWER(email) = $1`,
    [emailLower],
  );
  if (existing.rows[0]) {
    const row = existing.rows[0];
    if (row.userType !== 'CLIENT') {
      throw new HubAccessError('This email belongs to an internal team member and cannot be granted client hub access.');
    }
    const userId = row.id;
    if (row.status === 'DISABLED') {
      await pool.query(`UPDATE "User" SET status = 'ACTIVE'::"UserStatus", "updatedAt" = NOW() WHERE id = $1`, [userId]);
    }
    return userId;
  }
  const firstName = (contact.firstName || '').trim() || 'User';
  const lastName = (contact.lastName || '').trim() || '';
  const created = await pool.query(
    `INSERT INTO "User" (id, "firstName", "lastName", email, "userType", status, "internalRole", "avatarColor", "createdAt", "updatedAt")
     VALUES (gen_random_uuid(), $1, $2, $3, 'CLIENT'::"UserType", 'INVITED'::"UserStatus", 'SALES'::"InternalRole", '#6366F1', NOW(), NOW())
     RETURNING id`,
    [firstName, lastName, emailLower],
  );
  return created.rows[0].id;
}

async function upsertMembership(orgId: string, userId: string, stampInvite: boolean): Promise<string> {
  const res = await pool.query(
    `INSERT INTO "OrganizationMembership" (
       id, "organizationId", "userId", role,
       "isPrimaryContact", "canManageUsers", "canSubmitProjects",
       "canViewProjects", "canViewInvoices", "canPayInvoices", "canApproveQuotes",
       "inviteSentAt", "createdAt"
     ) VALUES (
       gen_random_uuid(), $1, $2, 'MEMBER'::"MembershipRole",
       false, false, true, true, false, false, false,
       ${stampInvite ? 'NOW()' : 'NULL'}, NOW()
     )
     ON CONFLICT ("organizationId", "userId") DO UPDATE SET
       ${stampInvite ? '"inviteSentAt" = NOW()' : '"inviteSentAt" = "OrganizationMembership"."inviteSentAt"'}
     RETURNING id`,
    [orgId, userId],
  );
  return res.rows[0].id;
}

function portalUrlFrom(request: Request, orgId: string): string {
  const origin = request.headers.get('origin') || '';
  return `${origin}/portal/${orgId}`;
}

async function handleAction(request: Request, orgId: string, contactId: string, action: string) {
  const contact = await loadContact(orgId, contactId);
  if (!contact) return Response.json({ error: 'Contact not found' }, { status: 404 });
  const displayName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'this contact';

  switch (action) {
    case 'enableHubAccess':
    case 'resendInvite': {
      if (!contact.email) return Response.json({ error: 'This contact needs an email before enabling hub access.' }, { status: 400 });
      let userId: string;
      try {
        userId = await findOrCreateClientUser(contact);
      } catch (e) {
        if (e instanceof HubAccessError) return Response.json({ error: e.message }, { status: 409 });
        throw e;
      }
      const membershipId = await upsertMembership(orgId, userId, true);
      await pool.query(`UPDATE "Contact" SET "linkedUserId" = $1, "updatedAt" = NOW() WHERE id = $2`, [userId, contactId]);

      const { subject, html, text } = buildClientInviteEmail({
        clientName: displayName,
        orgName: contact.orgName || 'your organization',
        portalUrl: portalUrlFrom(request, orgId),
      });
      const emailResult = await sendEmail({ to: contact.email, subject, html, text });

      await logActivity(
        orgId,
        action === 'resendInvite' ? 'hub_invite_resent' : 'hub_invite_sent',
        `Hub invite ${action === 'resendInvite' ? 'resent' : 'sent'} to ${displayName} (${contact.email})`,
        { contactId, userId, membershipId, emailSent: !emailResult.error },
      );
      break;
    }

    case 'disableHubAccess': {
      if (!contact.linkedUserId) return Response.json({ error: 'This contact has no hub access to disable.' }, { status: 400 });
      await pool.query(`UPDATE "User" SET status = 'DISABLED'::"UserStatus", "updatedAt" = NOW() WHERE id = $1`, [contact.linkedUserId]);
      await logActivity(orgId, 'hub_user_disabled', `Hub access disabled for ${displayName}`, { contactId, userId: contact.linkedUserId });
      break;
    }

    case 'promoteAdmin':
    case 'removeAdmin': {
      if (!contact.linkedUserId) return Response.json({ error: 'Enable hub access before changing the admin role.' }, { status: 400 });
      const role = action === 'promoteAdmin' ? 'ORG_ADMIN' : 'MEMBER';
      const upd = await pool.query(
        `UPDATE "OrganizationMembership" SET role = $1::"MembershipRole", "canManageUsers" = $2
          WHERE "organizationId" = $3 AND "userId" = $4 RETURNING id`,
        [role, action === 'promoteAdmin', orgId, contact.linkedUserId],
      );
      if (!upd.rows[0]) return Response.json({ error: 'No hub membership found for this contact.' }, { status: 400 });
      await logActivity(
        orgId,
        action === 'promoteAdmin' ? 'hub_admin_promoted' : 'hub_admin_removed',
        `${displayName} ${action === 'promoteAdmin' ? 'promoted to Org Admin' : 'removed as Org Admin'}`,
        { contactId, userId: contact.linkedUserId },
      );
      break;
    }

    case 'resetPassword': {
      if (!contact.linkedUserId || !contact.email) return Response.json({ error: 'This contact has no hub login to reset.' }, { status: 400 });
      const token = crypto.randomBytes(32).toString('hex');
      const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await pool.query(
        `UPDATE "User" SET "passwordResetToken" = $1, "passwordResetExpiry" = $2, "updatedAt" = NOW() WHERE id = $3`,
        [token, expiry, contact.linkedUserId],
      );
      const origin = request.headers.get('origin') || '';
      const resetUrl = `${origin}/portal/reset-password?token=${token}`;
      const { subject, html, text } = buildPasswordResetEmail({ clientName: displayName, resetUrl });
      await sendEmail({ to: contact.email, subject, html, text });
      await logActivity(orgId, 'hub_password_reset', `Password reset email sent to ${contact.email}`, { contactId, userId: contact.linkedUserId });
      break;
    }

    default:
      return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }

  // Return the freshly-derived contact so the client reflects the new state.
  const contacts = await fetchEnrichedContacts(orgId);
  const updated = contacts.find((c) => c.id === contactId);
  return Response.json({ ok: true, contact: updated ?? null });
}

export async function PATCH(request: Request, params?: { id: string; contactId: string }) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();
  const { id, contactId } = params ?? ({} as { id: string; contactId: string });
  if (!id || !contactId) return Response.json({ error: 'Not found' }, { status: 404 });

  try {
    const body = await request.json();

    // Consolidated people/auth provisioning action.
    if (body.action) {
      return await handleAction(request, id, contactId, String(body.action));
    }

    // Fallback: direct linkedUserId set (kept for back-compat with link repair).
    if (body.linkedUserId !== undefined) {
      await pool.query(
        `UPDATE "Contact" SET "linkedUserId" = $1, "updatedAt" = NOW() WHERE id = $2 AND "organizationId" = $3`,
        [body.linkedUserId || null, contactId, id],
      );
    }
    const result = await pool.query(`SELECT * FROM "Contact" WHERE id = $1 AND "organizationId" = $2`, [contactId, id]);
    const c = result.rows[0];
    if (!c) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ id: c.id, linkedUserId: c.linkedUserId ?? null });
  } catch (err) {
    console.error('[PATCH /api/orgs/:id/contacts/:contactId]', err);
    return Response.json({ error: 'Failed to update contact' }, { status: 500 });
  }
}

export async function PUT(request: Request, params?: { id: string; contactId: string }) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();
  const { id, contactId } = params ?? ({} as { id: string; contactId: string });
  if (!id || !contactId) return Response.json({ error: 'Not found' }, { status: 404 });

  try {
    const body = await request.json();
    const result = await pool.query(
      `UPDATE "Contact" SET
        "firstName" = $1, "lastName" = $2, email = $3, phone = $4, role = $5,
        notes = $6, "isPrimary" = $7, department = $8, "updatedAt" = NOW()
      WHERE id = $9 AND "organizationId" = $10 RETURNING *`,
      [
        body.firstName,
        body.lastName,
        body.email ?? null,
        formatPhoneOrNull(body.phone),
        body.role ?? null,
        body.notes ?? null,
        body.isPrimary ?? false,
        body.department ?? null,
        contactId,
        id,
      ],
    );
    if (!result.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    // linkedUserId is the authoritative Contact ↔ User key; update it only when
    // explicitly provided so normal edits never clobber an existing link.
    let linkedUserId = result.rows[0]?.linkedUserId ?? null;
    if (body.linkedUserId !== undefined) {
      linkedUserId = body.linkedUserId || null;
      await pool.query(
        `UPDATE "Contact" SET "linkedUserId" = $1, "updatedAt" = NOW() WHERE id = $2 AND "organizationId" = $3`,
        [linkedUserId, contactId, id],
      );
    }
    const c = result.rows[0];
    return Response.json({
      id: c.id,
      organizationId: c.organizationId ?? undefined,
      firstName: c.firstName,
      lastName: c.lastName,
      role: c.role ?? undefined,
      email: c.email ?? undefined,
      phone: c.phone ?? undefined,
      department: c.department ?? undefined,
      notes: c.notes ?? undefined,
      isPrimary: c.isPrimary ?? false,
      linkedUserId: linkedUserId ?? undefined,
      createdAt: new Date(c.createdAt).toISOString(),
    });
  } catch (err) {
    console.error('[PUT /api/orgs/:id/contacts/:contactId]', err);
    return Response.json({ error: 'Failed to update contact' }, { status: 500 });
  }
}

export async function DELETE(request: Request, params?: { id: string; contactId: string }) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();
  const { id, contactId } = params ?? ({} as { id: string; contactId: string });
  if (!id || !contactId) return Response.json({ error: 'Not found' }, { status: 404 });

  try {
    const res = await pool.query(`DELETE FROM "Contact" WHERE id = $1 AND "organizationId" = $2`, [contactId, id]);
    if (res.rowCount === 0) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: 'Failed to delete contact' }, { status: 500 });
  }
}
